/**
 * Legibility of the letters of a Spare composition: how far each letter is
 * tangled with the others, and whether its orientation still reads as a
 * letter. A sigil fails Spare's aim when one letter can be read on its own.
 *
 * In line art nothing hides anything: a C crossed by straight lines is still a
 * C. What dissolves a letter is other strokes running along it, close enough
 * to merge with its outline. Hence the measure: the share of each letter's
 * length lying near another letter's stroke ("entanglement"). A letter whose
 * orientation still reads as a letter needs more of it than one turned into
 * an unfamiliar shape (see `readsAsLetter`).
 *
 * Exposes `letterLegibility`, `readsAsLetter`, `readsInAnyOrientation` and
 * their thresholds. Pure.
 */
import type { Point } from '../sigil/types.ts';
import type { SpareCandidate } from './generateSpareCandidates.ts';
import { segmentLength, strokeSegments } from './geometry.ts';
import type { Segment } from './geometry.ts';
import type { CapitalLetter } from './glyphs/index.ts';
import type { QuarterTurn } from './placement.ts';

/**
 * Distance under which a point of a letter counts as tangled with another
 * letter's stroke, in frame units: 2.5 default stroke widths (1.2). Strokes
 * that close leave a gap of about one stroke width or less, and the eye reads
 * them as one knot rather than as two outlines.
 */
export const ENTANGLEMENT_DISTANCE = 3;

/**
 * Smallest share of its length a letter in an unfamiliar orientation must
 * have tangled with the others. Measured on the reference boards: the letters
 * a reader could pick out alone (a C, an M) had 0.2–0.4 of their length
 * tangled, the dissolved ones 0.5 and more.
 */
export const MIN_ENTANGLEMENT = 0.5;

/**
 * Tangled share at which a letter whose orientation reads as a letter (see
 * `readsAsLetter`) stops adding to its base deficit. The eye completes a
 * familiar shape from fragments: on the reference boards an upside-down V
 * 0.6 tangled and an upside-down M 0.9 tangled still showed an A.
 */
export const MIN_ENTANGLEMENT_LETTER_LIKE = 0.9;

/**
 * Deficit a letter in a readable orientation always carries, however tangled.
 * Crossing strokes do not hide a familiar shape (an upright S 0.6 tangled,
 * an upside-down M 0.9 tangled still read on the reference boards), so the
 * score first avoids such orientations, then prefers them tangled. Letters
 * readable in every orientation (C, N…) pay it in every candidate, which
 * leaves the ranking to their entanglement.
 */
export const LETTER_LIKE_BASE_DEFICIT = 0.5;

/**
 * Spacing of the points sampled along a letter, in frame units: a third of
 * `ENTANGLEMENT_DISTANCE`, so that no tangled stretch falls between samples.
 */
const SAMPLE_SPACING = 1;

/**
 * Letters that a quarter turn turns into a letter again: C and U into each
 * other (∩, ⊂), N and Z into each other, O, Q (an O with a tail) and X into
 * themselves. Other letters laid on their side become unfamiliar signs: on
 * the reference boards a C at 270° was read, an S at 90° (∽) was not.
 */
const LETTERS_AFTER_QUARTER_TURN: ReadonlySet<CapitalLetter> = new Set([
  'C',
  'N',
  'O',
  'Q',
  'U',
  'X',
  'Z',
]);

/** Legibility of one letter of a composition. */
export interface LetterLegibility {
  /** Share of the letter's length within `ENTANGLEMENT_DISTANCE` of another letter's stroke, 0–1. */
  readonly entanglement: number;
  /** Whether its orientation reads as a letter (see `readsAsLetter`). */
  readonly readsAsLetter: boolean;
  /**
   * How readable the letter remains, 0–1. In an unfamiliar orientation, its
   * shortfall from `MIN_ENTANGLEMENT` as a fraction of it (0 once reached);
   * in a letter-like one, `LETTER_LIKE_BASE_DEFICIT` plus the rest, scaled
   * from all of it at `MIN_ENTANGLEMENT` or less to none at
   * `MIN_ENTANGLEMENT_LETTER_LIKE`. 1 when not tangled at all.
   */
  readonly deficit: number;
}

/**
 * Rates the legibility of every letter of a composition.
 *
 * Not applicable to fewer than three letters: with one letter there is
 * nothing to tangle with (its deficit is 0), and two letters cannot hide each
 * other entirely, so the criterion "no letter readable on its own" is not
 * required of one- and two-letter intentions; their values are still computed.
 *
 * @param candidate - Composition in the 0–100 frame, with the owner of each stroke.
 * @returns One entry per letter, in input order.
 */
export function letterLegibility(candidate: SpareCandidate): LetterLegibility[] {
  const letterCount = candidate.placements.length;
  const byLetter: Segment[][] = Array.from({ length: letterCount }, () => []);
  candidate.strokes.forEach((stroke, index) => {
    const owner = candidate.strokeLetters[index];
    if (owner !== undefined) byLetter[owner]?.push(...strokeSegments([stroke]));
  });
  const grid = buildGrid(byLetter);

  return candidate.placements.map((placement, letter) => {
    const letterLike = readsAsLetter(placement.letter, placement.rotation);
    if (letterCount < 2) return { entanglement: 1, readsAsLetter: letterLike, deficit: 0 };
    const entanglement = entangledShare(byLetter[letter] ?? [], letter, grid);
    return {
      entanglement,
      readsAsLetter: letterLike,
      deficit: deficitOf(entanglement, letterLike),
    };
  });
}

/**
 * Turns a letter's entanglement into its legibility deficit (see
 * `LetterLegibility.deficit`).
 *
 * @param entanglement - Tangled share of its length, 0–1.
 * @param letterLike - Whether its orientation reads as a letter.
 * @returns The deficit, 0–1.
 */
function deficitOf(entanglement: number, letterLike: boolean): number {
  if (!letterLike) return Math.max(0, MIN_ENTANGLEMENT - entanglement) / MIN_ENTANGLEMENT;
  // The extra part runs from MIN_ENTANGLEMENT (full) to MIN_ENTANGLEMENT_LETTER_LIKE
  // (none): below the share that hides a turned letter, a familiar one is wholly visible.
  const range = MIN_ENTANGLEMENT_LETTER_LIKE - MIN_ENTANGLEMENT;
  const shortfall = Math.min(1, Math.max(0, MIN_ENTANGLEMENT_LETTER_LIKE - entanglement) / range);
  return LETTER_LIKE_BASE_DEFICIT + (1 - LETTER_LIKE_BASE_DEFICIT) * shortfall;
}

/**
 * Tells whether a letter, once mirrored and turned, still reads as a letter.
 * True when it stands upright or upside down, mirrored or not: it keeps its
 * vertical structure, and the eye reads it as itself (a reversed C), as
 * another letter (an upside-down V is an A, the middle of an upside-down M
 * too) or as a familiar reversed sign. Quarter turns lay the letter on its
 * side and break that reading, except for the letters that become a letter
 * again (`LETTERS_AFTER_QUARTER_TURN`).
 *
 * The mirror plays no part: reversed letters are read as easily as upright ones.
 *
 * @param letter - Upper-case letter A–Z.
 * @param rotation - Clockwise quarter turn applied after the (ignored) mirror.
 * @returns True when the orientation leaves the letter recognisable.
 */
export function readsAsLetter(letter: CapitalLetter, rotation: QuarterTurn): boolean {
  return rotation === 0 || rotation === 180 || readsInAnyOrientation(letter);
}

/**
 * Tells whether a letter reads as a letter whatever its orientation (see
 * `LETTERS_AFTER_QUARTER_TURN`): no draw can hide it by turning it, only by
 * covering it, so the composition keeps it at the heart of the seal.
 *
 * @param letter - Upper-case letter A–Z.
 * @returns True for C, N, O, Q, U, X and Z.
 */
export function readsInAnyOrientation(letter: CapitalLetter): boolean {
  return LETTERS_AFTER_QUARTER_TURN.has(letter);
}

/**
 * Places points along segments at a regular spacing, at the middle of equal steps.
 *
 * @param segments - Segments to sample.
 * @param spacing - Largest distance between two samples of a segment.
 * @returns At least one point per segment of positive length.
 */
function samplePoints(segments: readonly Segment[], spacing: number): Point[] {
  const points: Point[] = [];
  for (const { start, end } of segments) {
    const length = segmentLength({ start, end });
    if (length === 0) continue;
    const count = Math.ceil(length / spacing);
    for (let step = 0; step < count; step += 1) {
      const t = (step + 0.5) / count;
      points.push({ x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y) });
    }
  }
  return points;
}

/**
 * A segment of a composition with the letter it belongs to, stored as origin
 * and direction so that the hot distance test needs no allocation.
 */
interface OwnedSegment {
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  /** Squared length, 0 for a point. */
  readonly squaredLength: number;
  readonly letter: number;
}

/**
 * Segments bucketed by square cells of side `ENTANGLEMENT_DISTANCE`, keyed by
 * `cellKey`, for near-point queries.
 */
type SegmentGrid = Map<number, OwnedSegment[]>;

/**
 * Number of cell indices reserved per row in `cellKey`: far more than the
 * frame needs (100 / 3 ≈ 34 cells, plus the widening), so keys never collide.
 */
const GRID_STRIDE = 1024;

/** Squared `ENTANGLEMENT_DISTANCE`, compared with squared distances. */
const SQUARED_ENTANGLEMENT_DISTANCE = ENTANGLEMENT_DISTANCE ** 2;

/**
 * Buckets every segment into the cells its box, widened by
 * `ENTANGLEMENT_DISTANCE`, overlaps, so that a point only needs the segments
 * of its own cell.
 *
 * @param byLetter - Segments of each letter.
 * @returns The grid.
 */
function buildGrid(byLetter: readonly (readonly Segment[])[]): SegmentGrid {
  const grid: SegmentGrid = new Map();
  byLetter.forEach((segments, letter) => {
    for (const { start, end } of segments) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const owned = { x: start.x, y: start.y, dx, dy, squaredLength: dx * dx + dy * dy, letter };
      const minX = cellIndex(Math.min(start.x, end.x) - ENTANGLEMENT_DISTANCE);
      const maxX = cellIndex(Math.max(start.x, end.x) + ENTANGLEMENT_DISTANCE);
      const minY = cellIndex(Math.min(start.y, end.y) - ENTANGLEMENT_DISTANCE);
      const maxY = cellIndex(Math.max(start.y, end.y) + ENTANGLEMENT_DISTANCE);
      for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
          const key = cellKey(x, y);
          const bucket = grid.get(key);
          if (bucket === undefined) grid.set(key, [owned]);
          else bucket.push(owned);
        }
      }
    }
  });
  return grid;
}

/**
 * Index of the grid cell containing a coordinate.
 *
 * @param value - Coordinate in frame units.
 * @returns The cell index along that axis.
 */
function cellIndex(value: number): number {
  return Math.floor(value / ENTANGLEMENT_DISTANCE);
}

/**
 * Numeric key of a cell, cheaper to hash than a string.
 *
 * @param x - Cell index along x.
 * @param y - Cell index along y.
 * @returns A key unique for indices within ±`GRID_STRIDE` / 2.
 */
function cellKey(x: number, y: number): number {
  return x * GRID_STRIDE + y;
}

/**
 * Whether a point lies within `ENTANGLEMENT_DISTANCE` of a segment.
 *
 * @param px - Point abscissa.
 * @param py - Point ordinate.
 * @param segment - Segment to test.
 * @returns True when the closest point of the segment is close enough.
 */
function isNear(px: number, py: number, segment: OwnedSegment): boolean {
  const { x, y, dx, dy, squaredLength } = segment;
  const t =
    squaredLength === 0
      ? 0
      : Math.min(1, Math.max(0, ((px - x) * dx + (py - y) * dy) / squaredLength));
  const ex = x + t * dx - px;
  const ey = y + t * dy - py;
  return ex * ex + ey * ey <= SQUARED_ENTANGLEMENT_DISTANCE;
}

/**
 * Share of a letter's length within `ENTANGLEMENT_DISTANCE` of another letter's
 * stroke, measured on points every `SAMPLE_SPACING` along it.
 *
 * @param segments - The letter's own segments.
 * @param letter - Its index, to skip its own segments in the grid.
 * @param grid - Every segment of the composition.
 * @returns A share in [0, 1]; 0 for a letter without length.
 */
function entangledShare(segments: readonly Segment[], letter: number, grid: SegmentGrid): number {
  const samples = samplePoints(segments, SAMPLE_SPACING);
  if (samples.length === 0) return 0;
  let tangled = 0;
  for (const { x, y } of samples) {
    const bucket = grid.get(cellKey(cellIndex(x), cellIndex(y)));
    if (bucket?.some((owned) => owned.letter !== letter && isNear(x, y, owned))) tangled += 1;
  }
  return tangled / samples.length;
}
