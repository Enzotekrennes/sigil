/**
 * Score of the Spare bind-rune candidates (plan decision D19): measures, on
 * the merged strokes of a rune fitted into the 0–100 frame, what makes the
 * reference runes look clean, and adds the measures into one penalty, the
 * lowest winning. Hatches (parallel strokes drawn a hair apart) weigh far more
 * than anything else; then ink beyond a ceiling, a silhouette too squat or
 * too thin, asymmetry, imbalance between the two sides of the stem,
 * strokes crossing one another, letters drawn over one another, and letters
 * shrunk by a long stem.
 *
 * Exposes `scoreRune`, `chooseRune`, the weights and thresholds, and the
 * `RuneScore` and `ScoredLetter` types. Pure and deterministic. Does not
 * compose, fit or merge: it reads finished strokes and placed letters.
 */
import { DRAWING_SIZE, FRAME_SIZE } from '../sigil/frame.ts';
import type { Point, SpareRuneScore, SpareRuneStyle } from '../sigil/types.ts';
import { distance, segmentLength, strokeSegments } from './geometry.ts';
import type { Segment } from './geometry.ts';
import { findHatches } from './hatches.ts';

/** x of the stem in the frame: the vertical through the centre. */
export const STEM_X = FRAME_SIZE / 2;

/**
 * Penalty of each hatch. Ten times the largest sum the other terms reach on
 * the reference words, so that a candidate with a hatch never wins over one
 * without: hatches are what made the previous composition look scribbled.
 */
export const HATCH_WEIGHT = 10;

/**
 * Ink ceiling: total stroke length allowed, as a multiple of the drawing
 * area's side (80). A five-letter rune uses about 4; past 6.5 strokes crowd
 * the stem and the rune turns into a block of lines.
 */
export const INK_CEILING = 6.5;

/** Penalty per tenth of the ink ceiling exceeded. */
export const INK_WEIGHT = 0.5;

/**
 * Height-to-width ratio past which a rune counts as a thin pole, its letters
 * shrunk to fit the stem's length in the frame. The composition already keeps
 * runes at least 1.25 times as high as wide (`MIN_ASPECT_RATIO`); the
 * reference runes stand about twice as high as wide.
 */
export const MAX_ASPECT_RATIO = 2.5;

/** Penalty per unit of height-to-width ratio beyond `MAX_ASPECT_RATIO`. */
export const THINNESS_WEIGHT = 2;

/**
 * Penalty of a fully asymmetric rune (no stroke mirrored across the stem),
 * per layout style; a symmetric one costs 0. Most reference runes are
 * symmetric, and those that are not still read as one sign, so symmetry is
 * preferred, not required: strongly in the symmetric style, where an
 * asymmetric candidate is a letter that could not be doubled cleanly; less in
 * the mixed style, so that its runes do not all end up doubled like the
 * symmetric variant; least in the paired style, whose letters face each other.
 */
export const SYMMETRY_WEIGHTS: Readonly<Record<SpareRuneStyle, number>> = {
  symmetric: 2,
  mixed: 1,
  paired: 0.5,
};

/** Distance, in frame units, within which a mirrored point counts as matched by a stroke. */
export const SYMMETRY_TOLERANCE = 1;

/**
 * Penalty of a rune with all its ink on one side of the stem; 0 when both
 * sides carry the same length. A lopsided rune looks like it leans.
 */
export const BALANCE_WEIGHT = 1;

/**
 * Penalty of each crossing between two strokes away from the stem. Some
 * crossings belong to the letters (X, the tail of Q); many of them mean
 * letters drawn over each other, the clutter the bind rune avoids.
 */
export const CROSSING_WEIGHT = 0.15;

/**
 * Penalty of a letter's bounding box lying fully inside another's on the
 * same side of the stem. Bind runes share strokes, so some overlap is
 * welcome (it costs a fraction of this); letters drawn inside one another
 * turn into a knot no single stroke can be followed in.
 */
export const CROWDING_WEIGHT = 1;

/**
 * Mean letter height, in frame units, under which letters count as shrunk:
 * 30 % of the drawing area. The stem spans the frame's height, so a rune
 * whose letters are spread along a long stem, or stacked one per level when
 * they could share levels, draws them small.
 */
export const TARGET_LETTER_HEIGHT = 24;

/** Penalty of letters of no height, falling linearly to 0 at `TARGET_LETTER_HEIGHT`. */
export const SMALLNESS_WEIGHT = 3;

/** Spacing of the points sampled along strokes for symmetry and balance, in frame units. */
const SAMPLE_SPACING = 1;

/** Distance from the stem under which a crossing counts as on it, in frame units. */
const ON_STEM = 0.5;

/** Shortest piece of a segment kept as a crossing's own, excluding its ends. */
const END_MARGIN = 1e-6;

/**
 * Measures of one rune and the penalty they add up to: the model type the
 * explanation step carries, so that the panel shows what was scored.
 */
export type RuneScore = SpareRuneScore;

/** A letter of the rune as the score sees it, in the 0–100 frame. */
export interface ScoredLetter {
  /** Side of the stem the letter occupies, its double included. */
  readonly side: 'left' | 'right' | 'both';
  /** y of its cap line and of its baseline. */
  readonly top: number;
  readonly bottom: number;
  /** Its strokes as placed (its double's included), before merging. */
  readonly strokes: readonly (readonly Point[])[];
}

/**
 * Scores a rune.
 *
 * @param strokes - Merged polylines in the 0–100 frame, stem on x = `STEM_X`.
 * @param letters - The letters as placed, for the crowding and size terms.
 * @param style - Layout style of the variant, which sets the symmetry weight.
 * @returns The measures and the penalty (see the weights).
 */
export function scoreRune(
  strokes: readonly (readonly Point[])[],
  letters: readonly ScoredLetter[],
  style: SpareRuneStyle,
): RuneScore {
  const segments = strokeSegments(strokes).filter((segment) => segmentLength(segment) > 0);
  const hatches = findHatches(segments).length;
  const inkLength = segments.reduce((sum, segment) => sum + segmentLength(segment), 0);
  const ink = inkLength / DRAWING_SIZE;
  const aspectRatio = aspectOf(strokes.flat());
  const samples = sampleSegments(segments);
  const mirrored = samples.filter((point) =>
    isNearAny({ x: 2 * STEM_X - point.x, y: point.y }, segments, SYMMETRY_TOLERANCE),
  ).length;
  const symmetry = samples.length === 0 ? 1 : mirrored / samples.length;
  const left = samples.filter((point) => point.x < STEM_X - ON_STEM).length;
  const right = samples.filter((point) => point.x > STEM_X + ON_STEM).length;
  const imbalance = left + right === 0 ? 0 : Math.abs(left - right) / (left + right);
  const crossings = countCrossings(segments);
  const crowding = crowdingOf(letters);
  const letterHeight =
    letters.reduce((sum, letter) => sum + letter.bottom - letter.top, 0) /
    Math.max(1, letters.length);

  const penalty =
    HATCH_WEIGHT * hatches +
    INK_WEIGHT * Math.max(0, (ink / INK_CEILING - 1) * 10) +
    THINNESS_WEIGHT * Math.max(0, aspectRatio - MAX_ASPECT_RATIO) +
    SYMMETRY_WEIGHTS[style] * (1 - symmetry) +
    BALANCE_WEIGHT * imbalance +
    CROSSING_WEIGHT * crossings +
    CROWDING_WEIGHT * crowding +
    SMALLNESS_WEIGHT * Math.max(0, 1 - letterHeight / TARGET_LETTER_HEIGHT);
  return {
    hatches,
    ink,
    aspectRatio,
    symmetry,
    imbalance,
    crossings,
    crowding,
    letterHeight,
    penalty,
  };
}

/**
 * How much the letters are drawn over one another: for every two letters on
 * a common side of the stem, the area shared by their bounding boxes over
 * the smaller box's area, summed. Boxes are at least 1 unit thick, so that a
 * bar or a single vertical still has an area.
 *
 * @param letters - Placed letters.
 * @returns 0 when no two letters overlap; 1 for each letter fully inside another.
 */
function crowdingOf(letters: readonly ScoredLetter[]): number {
  const boxes = letters.map((letter) => {
    const points = letter.strokes.flat();
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const box = {
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys),
    };
    return {
      ...box,
      side: letter.side,
      area: Math.max(1, box.right - box.left) * Math.max(1, box.bottom - box.top),
    };
  });
  let crowding = 0;
  boxes.forEach((a, i) => {
    boxes.slice(i + 1).forEach((b) => {
      const facing = a.side === 'both' || b.side === 'both' || a.side === b.side;
      if (!facing) return;
      const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (width <= 0 || height <= 0) return;
      crowding += (width * height) / Math.min(a.area, b.area);
    });
  });
  return crowding;
}

/**
 * Picks the best of several scored runes.
 *
 * @param scores - Scores in candidate order, at least one.
 * @returns The index of the lowest penalty; the first one on a tie, so the
 *   choice is deterministic.
 */
export function chooseRune(scores: readonly RuneScore[]): number {
  let best = 0;
  scores.forEach((score, index) => {
    const current = scores[best];
    if (current !== undefined && score.penalty < current.penalty) best = index;
  });
  return best;
}

/**
 * Height-to-width ratio of the bounding box of some points.
 *
 * @param points - At least one point.
 * @returns The ratio; infinite for a drawing of no width.
 */
function aspectOf(points: readonly Point[]): number {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return width === 0 ? Number.POSITIVE_INFINITY : height / width;
}

/**
 * Points spread evenly along segments, about `SAMPLE_SPACING` apart, so that
 * counting them weighs strokes by their length.
 *
 * @param segments - Segments to sample.
 * @returns The sample points, at least one per segment.
 */
function sampleSegments(segments: readonly Segment[]): Point[] {
  const samples: Point[] = [];
  for (const { start, end } of segments) {
    const count = Math.max(1, Math.round(distance(start, end) / SAMPLE_SPACING));
    for (let step = 0; step < count; step += 1) {
      const t = (step + 0.5) / count;
      samples.push({ x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y) });
    }
  }
  return samples;
}

/**
 * Distance from a point to a segment.
 *
 * @param point - Point measured.
 * @param segment - Segment of positive length.
 * @returns The distance in frame units.
 */
function pointToSegment(point: Point, segment: Segment): number {
  const { start, end } = segment;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

/**
 * Counts the crossings between segments: points strictly inside both, away
 * from the stem by more than `ON_STEM`. Segments meeting at an end do not cross.
 *
 * @param segments - Segments of positive length.
 * @returns The number of crossings.
 */
function countCrossings(segments: readonly Segment[]): number {
  let crossings = 0;
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const a = segments[i];
      const b = segments[j];
      if (a === undefined || b === undefined) continue;
      const crossing = crossingPoint(a, b);
      if (crossing !== undefined && Math.abs(crossing.x - STEM_X) > ON_STEM) crossings += 1;
    }
  }
  return crossings;
}

/**
 * Point where two segments cross, strictly inside both.
 *
 * @param a - First segment.
 * @param b - Second segment.
 * @returns The crossing point, or `undefined` when they do not cross (parallel,
 *   apart, or meeting at an end).
 */
function crossingPoint(a: Segment, b: Segment): Point | undefined {
  const rx = a.end.x - a.start.x;
  const ry = a.end.y - a.start.y;
  const sx = b.end.x - b.start.x;
  const sy = b.end.y - b.start.y;
  const denominator = rx * sy - ry * sx;
  if (denominator === 0) return undefined;
  const qx = b.start.x - a.start.x;
  const qy = b.start.y - a.start.y;
  const t = (qx * sy - qy * sx) / denominator;
  const u = (qx * ry - qy * rx) / denominator;
  const inside = (value: number): boolean => value > END_MARGIN && value < 1 - END_MARGIN;
  if (!inside(t) || !inside(u)) return undefined;
  return { x: a.start.x + t * rx, y: a.start.y + t * ry };
}

/**
 * Whether a point lies within a distance of any segment. Segments whose box,
 * widened by that distance, does not hold the point are skipped without
 * measuring: most of a rune is far from any given point.
 *
 * @param point - Point tested.
 * @param segments - Segments of positive length.
 * @param tolerance - Largest distance, in frame units.
 * @returns True when some segment passes within `tolerance` of the point.
 */
function isNearAny(point: Point, segments: readonly Segment[], tolerance: number): boolean {
  return segments.some(
    ({ start, end }) =>
      point.x >= Math.min(start.x, end.x) - tolerance &&
      point.x <= Math.max(start.x, end.x) + tolerance &&
      point.y >= Math.min(start.y, end.y) - tolerance &&
      point.y <= Math.max(start.y, end.y) + tolerance &&
      pointToSegment(point, { start, end }) <= tolerance,
  );
}
