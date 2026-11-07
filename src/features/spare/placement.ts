/**
 * Placement of the letter skeletons of a Spare composition: each Hershey glyph
 * is brought into a common unit frame, then mirrored, turned (mostly onto its
 * side), scaled (one lead letter largest) and moved near the centre (further
 * across its narrow axis) by pseudo-random draws, so that the letters end up
 * superimposed rather than written side by side, in a roughly square seal.
 *
 * Exposes `composeLetters`, the `LetterPlacement` trace it records for the
 * explanation panel, the bounds and weights of every draw (`drawTurn`,
 * `offsetReach`, `leadLetterFor`), and `looksUpright`, which tells whether an
 * orientation leaves a letter exactly as written. Works in "composition
 * units" (a glyph's larger side measures 1 at scale 1, centred on 0, y
 * downwards); fitting the result into the 0–100 sigil frame belongs to
 * `generateSpareCandidates`. Does not score, merge or simplify strokes.
 */
import type { RandomSource } from '../../lib/random.ts';
import { randomBetween } from '../../lib/random.ts';
import type { Point } from '../sigil/types.ts';
import { getGlyph } from './glyphs/index.ts';
import type { CapitalLetter, Glyph } from './glyphs/index.ts';
import { readsInAnyOrientation } from './legibility.ts';

/**
 * Turns applied to a letter, in degrees clockwise on screen. Quarter turns
 * only: Spare's sigils turn and flip letters at right angles, and keeping
 * stems vertical or horizontal lets letters share strokes (see
 * `STEM_SHARING_PROBABILITY`) and keeps the geometric, fine-line look of the
 * design. With the mirror they give the eight orientations of a square.
 */
export type QuarterTurn = 0 | 90 | 180 | 270;

/**
 * Chance of each turn, in the order they are tried by `drawTurn`. Laid on
 * its side (90° or 270°), a letter loses the vertical structure that makes it
 * readable, and the score rejects most letters left upright or upside down;
 * drawing these uniformly wasted half the draws per letter, so that a long
 * intention rarely had a candidate with every letter hidden. Three quarters of
 * the draws lie the letter down; the other turns stay possible, for the
 * letters that read in any case (C, O…) and for variety.
 */
export const TURN_WEIGHTS: readonly (readonly [QuarterTurn, number])[] = [
  [90, 0.375],
  [270, 0.375],
  [0, 0.125],
  [180, 0.125],
];

/**
 * How one letter was placed in a composition, in the order the transforms are
 * applied: mirror, then rotation, then scale, then offset.
 */
export interface LetterPlacement {
  /** The letter, upper-case A–Z. */
  readonly letter: CapitalLetter;
  /**
   * True when the letter is flipped left to right (reversed). A top-to-bottom
   * flip needs no flag of its own: it equals this flip followed by a half turn.
   */
  readonly mirrored: boolean;
  /** Clockwise turn applied after the mirror. */
  readonly rotation: QuarterTurn;
  /**
   * Size relative to the other letters: `MAX_LETTER_SCALE` for the lead
   * letter, in [`MIN_LETTER_SCALE`, `MAX_SUPPORT_SCALE`) for the others.
   */
  readonly scale: number;
  /**
   * Where the letter's centre lands, in composition units from the
   * composition's centre (1 = the larger side of an unscaled letter).
   */
  readonly offset: Point;
  /**
   * Index of the letter whose vertical stem this letter was moved onto, so
   * that both share one vertical line; `null` when it was not aligned.
   */
  readonly sharedStemWith: number | null;
}

/** Letters placed in composition units, before fitting into the sigil frame. */
export interface Composition {
  /** Every stroke of every glyph, letter by letter, glyph stroke order kept. */
  readonly strokes: readonly (readonly Point[])[];
  /** Index in `placements` of the letter each stroke belongs to, same length as `strokes`. */
  readonly strokeLetters: readonly number[];
  /** One placement per letter, in input order. */
  readonly placements: readonly LetterPlacement[];
}

/** Chance that a letter is reversed: even, so reversed and upright letters are equally likely. */
export const MIRROR_PROBABILITY = 0.5;

/**
 * Smallest letter size. A small letter sitting among large ones is crossed by
 * few of their strokes and stays readable on its own (the C picked out at the
 * first F2 acceptance run); from 0.7 up, every letter spans most of the seal
 * and runs into the others.
 */
export const MIN_LETTER_SCALE = 0.7;

/** Largest letter size: the unit size, so that no letter is more than ~1.4× another. */
export const MAX_LETTER_SCALE = 1;

/**
 * Largest size of the letters other than the lead letter (see
 * `composeLetters`). The lead letter, at `MAX_LETTER_SCALE`, then shapes the
 * outline of the seal; each variant leads with another letter, so that
 * successive variants differ in structure, not only in detail. Kept close to
 * the lead's size so that the lead letter still runs into the others.
 */
export const MAX_SUPPORT_SCALE = 0.85;

/**
 * Largest distance of a letter's centre from the composition's centre along
 * its long axis (the axis where its turned skeleton spans the full unit). A
 * tenth of a letter keeps the letters superimposed on almost their whole
 * length, so that each one's strokes run into the others'; wider offsets let
 * a letter slide out to the side, where it reads on its own.
 */
export const MAX_CENTRE_OFFSET = 0.1;

/**
 * Extra offset allowed across a letter's narrow axis, per unit of width it
 * lacks: a letter 0.6 wide may move `MAX_CENTRE_OFFSET + 0.4 × NARROW_AXIS_SPREAD`
 * across. Letters are taller than wide, and those laid on their side (the
 * orientations that hide them best) are wider than tall: superimposed on a
 * common centre they made wide, flat seals (width ≈ 1.4 × height). Fanning
 * them out across their thickness, while they keep overlapping along their
 * length, fills a square whatever the orientations.
 */
export const NARROW_AXIS_SPREAD = 0.75;

/**
 * Chance that a letter with a vertical stem is moved onto the stem of the
 * first letter that has one. Spare merges letters by letting them share
 * strokes; half the time keeps the effect frequent without making every
 * composition a column of stems.
 */
export const STEM_SHARING_PROBABILITY = 0.5;

/**
 * Shortest vertical segment counted as a stem, in unit glyph sizes. Half a
 * letter keeps the real stems (B, D, E, H, T…, full height) and leaves out
 * short verticals that would not read as a shared line.
 */
const MIN_STEM_LENGTH = 0.5;

/** Horizontal tolerance for a segment to count as vertical; glyph points are integers, so tiny. */
const VERTICAL_TOLERANCE = 1e-9;

/**
 * Decimals kept when comparing two orientations of a skeleton. Unit-frame
 * coordinates are exact ratios of small integers, so a millionth only absorbs
 * floating-point noise.
 */
const SHAPE_COMPARISON_DECIMALS = 6;

/** Sine and cosine of each quarter turn, exact so that vertical lines stay exactly vertical. */
const TURN_MATRIX: Readonly<Record<QuarterTurn, { readonly cos: number; readonly sin: number }>> = {
  0: { cos: 1, sin: 0 },
  90: { cos: 0, sin: 1 },
  180: { cos: -1, sin: 0 },
  270: { cos: 0, sin: -1 },
};

/**
 * Places every letter with pseudo-random transforms. Each letter consumes
 * exactly six draws (mirror, turn, scale, two offsets, stem sharing),
 * whatever the outcome, so that one letter's placement never shifts the draws
 * of the next ones.
 *
 * The lead letter is drawn at `MAX_LETTER_SCALE`, the others between
 * `MIN_LETTER_SCALE` and `MAX_SUPPORT_SCALE` (its scale draw is still made,
 * and ignored, to keep six draws per letter).
 *
 * Stem-sharing heuristic: the first letter whose oriented glyph has a
 * vertical segment of at least `MIN_STEM_LENGTH` becomes the anchor; each
 * later letter with such a stem is, with `STEM_SHARING_PROBABILITY`, moved
 * horizontally so that its longest stem lies on the anchor's longest stem.
 * Its vertical offset stays as drawn.
 *
 * @param letters - Distinct upper-case letters A–Z, already validated.
 * @param random - Generator to draw from; advanced by six steps per letter.
 * @param leadLetter - Index of the letter drawn largest; out of range (such
 *   as −1) when no letter leads.
 * @returns The strokes in composition units, the owner of each stroke and the
 *   placement of each letter.
 */
export function composeLetters(
  letters: readonly CapitalLetter[],
  random: RandomSource,
  leadLetter: number,
): Composition {
  const strokes: Point[][] = [];
  const strokeLetters: number[] = [];
  const placements: LetterPlacement[] = [];
  let anchor: { readonly index: number; readonly x: number } | undefined;

  for (const [index, letter] of letters.entries()) {
    const mirrored = random() < MIRROR_PROBABILITY;
    const rotation = drawTurn(random());
    const drawnScale = randomBetween(random, MIN_LETTER_SCALE, MAX_SUPPORT_SCALE);
    const scale = index === leadLetter ? MAX_LETTER_SCALE : drawnScale;
    const oriented = unitStrokes(getGlyph(letter)).map((stroke) =>
      stroke.map((point) => orient(point, mirrored, rotation)),
    );
    // A letter readable in any orientation is only hidden by being covered:
    // it stays at the heart of the seal, without the narrow-axis spread.
    const reach = readsInAnyOrientation(letter)
      ? { x: MAX_CENTRE_OFFSET, y: MAX_CENTRE_OFFSET }
      : offsetReach(oriented);
    let offset: Point = {
      x: randomBetween(random, -reach.x, reach.x),
      y: randomBetween(random, -reach.y, reach.y),
    };
    const wantsSharedStem = random() < STEM_SHARING_PROBABILITY;
    const stemX = longestStemX(oriented);
    let sharedStemWith: number | null = null;
    if (stemX !== undefined) {
      if (anchor === undefined) {
        anchor = { index, x: offset.x + scale * stemX };
      } else if (wantsSharedStem) {
        offset = { x: anchor.x - scale * stemX, y: offset.y };
        sharedStemWith = anchor.index;
      }
    }

    for (const stroke of oriented) {
      strokes.push(
        stroke.map((point) => ({ x: point.x * scale + offset.x, y: point.y * scale + offset.y })),
      );
      strokeLetters.push(index);
    }
    placements.push({ letter, mirrored, rotation, scale, offset, sharedStemWith });
  }

  return { strokes, strokeLetters, placements };
}

/**
 * Chooses the letter a variant leads with (drawn largest, see `composeLetters`):
 * successive variants take the letters in turn, skipping those readable in
 * any orientation, which drawn largest would stand out.
 *
 * @param letters - Distinct upper-case letters A–Z, at least one.
 * @param variant - Variant number, an integer ≥ 0.
 * @returns The index in `letters` of the lead letter.
 */
export function leadLetterFor(letters: readonly CapitalLetter[], variant: number): number {
  const candidates = letters.flatMap((letter, index) =>
    readsInAnyOrientation(letter) ? [] : [index],
  );
  if (candidates.length === 0) return variant % letters.length;
  return candidates[variant % candidates.length] ?? 0;
}

/**
 * Turns a uniform draw into a quarter turn with the chances of `TURN_WEIGHTS`.
 *
 * @param draw - Number in [0, 1).
 * @returns The turn whose cumulative weight first exceeds `draw`; the last
 *   one if rounding leaves `draw` above the total.
 */
export function drawTurn(draw: number): QuarterTurn {
  let cumulative = 0;
  for (const [turn, weight] of TURN_WEIGHTS) {
    cumulative += weight;
    if (draw < cumulative) return turn;
  }
  return 180;
}

/**
 * Largest offset of a letter's centre on each axis: `MAX_CENTRE_OFFSET`
 * along the axis it spans fully, more across a narrow axis (see
 * `NARROW_AXIS_SPREAD`).
 *
 * @param strokes - The letter's turned skeleton in the unit frame (larger side 1).
 * @returns The largest offset along x and along y, in composition units.
 */
export function offsetReach(strokes: readonly (readonly Point[])[]): Point {
  const points = strokes.flat();
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return {
    x: MAX_CENTRE_OFFSET + NARROW_AXIS_SPREAD * Math.max(0, 1 - width),
    y: MAX_CENTRE_OFFSET + NARROW_AXIS_SPREAD * Math.max(0, 1 - height),
  };
}

/**
 * Brings a glyph from Hershey units into the unit frame: centred on the middle
 * of its bounding box, its larger side scaled to 1, y still downwards. Letters
 * keep their proportions (I stays narrow, M wide).
 *
 * @param glyph - Glyph in its own frame.
 * @returns Its strokes in the unit frame, every point within [−0.5, 0.5] on both axes.
 */
function unitStrokes(glyph: Glyph): Point[][] {
  const { bounds } = glyph;
  const centreX = bounds.x + bounds.width / 2;
  const centreY = bounds.y + bounds.height / 2;
  const size = Math.max(bounds.width, bounds.height);
  return glyph.strokes.map((stroke) =>
    stroke.map((point) => ({ x: (point.x - centreX) / size, y: (point.y - centreY) / size })),
  );
}

/**
 * Applies the mirror then the clockwise quarter turn to a point of the unit frame.
 *
 * @param point - Point centred on the letter's middle.
 * @param mirrored - Whether to flip left to right first.
 * @param rotation - Clockwise turn on screen (y downwards).
 * @returns The transformed point, still centred on the letter's middle.
 */
function orient(point: Point, mirrored: boolean, rotation: QuarterTurn): Point {
  const x = mirrored ? -point.x : point.x;
  const { cos, sin } = TURN_MATRIX[rotation];
  return { x: x * cos - point.y * sin, y: x * sin + point.y * cos };
}

/**
 * Finds the horizontal position of a letter's longest vertical segment.
 *
 * @param strokes - Oriented strokes in the unit frame.
 * @returns The x of the longest vertical segment of at least
 *   `MIN_STEM_LENGTH`, the first one on ties, or `undefined` when there is none.
 */
function longestStemX(strokes: readonly (readonly Point[])[]): number | undefined {
  let best: { readonly x: number; readonly length: number } | undefined;
  for (const stroke of strokes) {
    for (let index = 1; index < stroke.length; index += 1) {
      const from = stroke[index - 1];
      const to = stroke[index];
      if (from === undefined || to === undefined) continue;
      if (Math.abs(to.x - from.x) > VERTICAL_TOLERANCE) continue;
      const length = Math.abs(to.y - from.y);
      if (length < MIN_STEM_LENGTH) continue;
      if (best === undefined || length > best.length) best = { x: from.x, length };
    }
  }
  return best?.x;
}

/**
 * Tells whether a letter, once mirrored and turned, still has exactly the
 * shape it has upright: the identity, or a symmetry of the letter (a reversed
 * M, an X or a Z turned by a half turn). Such a letter stays readable inside
 * the sigil, which the balance score penalises.
 *
 * @param letter - Upper-case letter A–Z.
 * @param mirrored - Whether the letter is flipped left to right.
 * @param rotation - Clockwise quarter turn applied after the mirror.
 * @returns True when the transformed skeleton draws the same set of segments
 *   as the upright one, whatever their direction or order.
 */
export function looksUpright(
  letter: CapitalLetter,
  mirrored: boolean,
  rotation: QuarterTurn,
): boolean {
  const uprightShape = segmentKeys(orientedSkeleton(letter, false, 0));
  const orientedShape = segmentKeys(orientedSkeleton(letter, mirrored, rotation));
  return (
    uprightShape.size === orientedShape.size &&
    [...orientedShape].every((key) => uprightShape.has(key))
  );
}

/**
 * Gives a letter's skeleton mirrored and turned, in the unit frame: centred on
 * the middle of the upright glyph's box, its larger side 1, y downwards.
 *
 * @param letter - Upper-case letter A–Z.
 * @param mirrored - Whether to flip it left to right first.
 * @param rotation - Clockwise quarter turn applied after the mirror.
 * @returns New strokes, every point within [−0.5, 0.5] on both axes.
 */
function orientedSkeleton(
  letter: CapitalLetter,
  mirrored: boolean,
  rotation: QuarterTurn,
): Point[][] {
  return unitStrokes(getGlyph(letter)).map((stroke) =>
    stroke.map((point) => orient(point, mirrored, rotation)),
  );
}

/**
 * Describes a drawing as a set of direction-free segment keys, for comparing shapes.
 *
 * @param strokes - Strokes in the unit frame.
 * @returns One key per segment, its endpoints rounded and sorted.
 */
function segmentKeys(strokes: readonly (readonly Point[])[]): Set<string> {
  const factor = 10 ** SHAPE_COMPARISON_DECIMALS;
  // `+ 0` turns −0 into 0, so that a point on an axis gets one key only.
  const rounded = (value: number): string => String(Math.round(value * factor) + 0);
  const pointKey = (point: Point): string => `${rounded(point.x)},${rounded(point.y)}`;
  const keys = new Set<string>();
  for (const stroke of strokes) {
    for (let index = 1; index < stroke.length; index += 1) {
      const from = stroke[index - 1];
      const to = stroke[index];
      if (from === undefined || to === undefined) continue;
      keys.add([pointKey(from), pointKey(to)].sort().join(' '));
    }
  }
  return keys;
}
