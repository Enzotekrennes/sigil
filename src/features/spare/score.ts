/**
 * Balance score of the Spare candidates and the final recentring: rates how
 * well a composition sits in the frame as a seal (centre of gravity, use of
 * the drawing area, a roughly square outline) and how well its letters
 * dissolve into one another (see `legibility.ts`), and moves the chosen one so
 * that its centre of gravity lands on the centre of the frame, inside the disc
 * the framing circle surrounds.
 *
 * Exposes `scoreCandidate`, `chooseCandidate`, `recentringFor`,
 * `applyRecentring`, the weights of the score and the `CandidateScore` type.
 * Pure and deterministic. Does not merge or simplify strokes.
 */
import { DRAWING_SIZE, FRAME_SIZE } from '../sigil/frame.ts';
import type { Point } from '../sigil/types.ts';
import type { SpareCandidate } from './generateSpareCandidates.ts';
import { centreOfGravity, distance, roundCoordinate, strokeSegments } from './geometry.ts';
import { letterLegibility } from './legibility.ts';
import type { LetterLegibility } from './legibility.ts';

/**
 * Largest distance allowed between a sigil's centre of gravity and the centre
 * of the frame, as a fraction of the frame side: the F2 acceptance criterion
 * (10 %). The balance term of the score is expressed in units of it.
 */
export const MAX_CENTRE_OFFSET_RATIO = 0.1;

/**
 * Weight of the balance term: an offset of the centre of gravity equal to the
 * F2 limit costs 1. Once recentred, a composition whose ink is far from the
 * middle of its own box sits visibly off-centre in the frame (and in the
 * optional framing circle), so this is the main criterion.
 */
export const BALANCE_WEIGHT = 1;

/**
 * Weight of the fill term: a recentred drawing covering none of the drawing
 * area would cost 1. It favours compact, square compositions, the shape of a
 * seal, over stretched ones, and those that must shrink a lot to be recentred.
 */
export const FILL_WEIGHT = 1;

/**
 * Weight of the legibility term, applied to the sum over letters of their
 * deficit (see `LetterLegibility.deficit`, 0–1). One readable letter is
 * enough to fail, so deficits are summed, not averaged, and every letter
 * still counts when one of them cannot be fully dissolved. A letter half as
 * tangled as required costs 2, as much as a 20 % centring gap, far beyond the
 * few percent that separate balanced candidates.
 */
export const LEGIBILITY_WEIGHT = 4;

/**
 * Spread under which a composition counts as shrunk. The spread is the
 * root-mean-square distance of the ink from the centre, as a share of
 * `DRAWING_RADIUS`, once recentred. Seals measured on the reference boards
 * spread 0.43–0.63; a small knot of letters with one stroke sticking far out
 * (a dot with a tail, which the bounding box and the fill do not see) 0.30–0.34.
 */
export const MIN_SPREAD = 0.4;

/**
 * Weight of the shrink term, `(MIN_SPREAD − spread) / MIN_SPREAD` when the
 * spread is under `MIN_SPREAD`. Packing letters into a small knot tangles
 * them all cheaply, so without a dominant cost the score would trade the
 * seal's size for legibility: a knot at 0.3 costs 5, more than two letters
 * left fully readable, and is chosen only when every candidate is one.
 */
export const SHRINK_WEIGHT = 20;

/**
 * Weight of the elongation term, `elongation − 1` where the elongation is the
 * larger side of the drawing's box over the smaller one. A seal reads as a
 * round or square sign; quarter-turned letters, which hide best, are wider
 * than tall and drift the compositions into flat bands. A 1.4 : 1 box costs
 * 1.2, as much as a 12 % centring gap, enough to choose a square candidate
 * among equally legible ones but not to bring back a readable letter.
 */
export const ELONGATION_WEIGHT = 3;

/** Elongation given to a drawing with no thickness at all, far above any real composition. */
const MAX_ELONGATION = 100;

/** Centre of the frame, where the centre of gravity of the final sigil lands. */
const FRAME_CENTRE: Point = { x: FRAME_SIZE / 2, y: FRAME_SIZE / 2 };

/**
 * Radius of the disc the recentred sigil is fitted into, around the frame
 * centre: half the drawing area. The disc lies inside the margin, so every
 * point stays in the frame, and inside the framing circle (radius 46), which
 * a square fit would cross with the corners of a drawing.
 */
export const DRAWING_RADIUS = DRAWING_SIZE / 2;

/** Rating of one candidate, every term of the penalty in its own unit. */
export interface CandidateScore {
  /**
   * Distance of the centre of gravity from the frame centre, before
   * recentring, as a fraction of the frame side (0.03 = 3 %).
   */
  readonly centreOffset: number;
  /** Share of the drawing area covered by the recentred drawing's bounding box, 0–1. */
  readonly fill: number;
  /** Root-mean-square distance of the recentred ink from the centre, as a share of `DRAWING_RADIUS`. */
  readonly spread: number;
  /** Larger side of the drawing's bounding box over the smaller one, 1 for a square. */
  readonly elongation: number;
  /** Legibility of each letter, in input order. */
  readonly legibility: readonly LetterLegibility[];
  /** Weighted sum of the penalties; the lowest wins. */
  readonly penalty: number;
}

/** Similarity that moves a drawing's centre of gravity onto the frame centre. */
export interface Recentring {
  /** Centre of gravity before the move, mapped onto the frame centre. */
  readonly from: Point;
  /** Uniform scale around it, so that every point stays within `DRAWING_RADIUS` of the centre. */
  readonly factor: number;
}

/**
 * Rates one candidate. Lower is better:
 * `BALANCE_WEIGHT × centreOffset / MAX_CENTRE_OFFSET_RATIO
 * + FILL_WEIGHT × (1 − fill) + SHRINK_WEIGHT × max(0, MIN_SPREAD − spread) / MIN_SPREAD
 * + LEGIBILITY_WEIGHT × Σ deficit + ELONGATION_WEIGHT × (elongation − 1)`.
 *
 * @param candidate - Composition fitted into the frame.
 * @returns The terms of the score and the total penalty.
 */
export function scoreCandidate(candidate: SpareCandidate): CandidateScore {
  const points = candidate.strokes.flat();
  const recentring = recentringFor(candidate.strokes, points);
  const centreOffset = distance(recentring.from, FRAME_CENTRE) / FRAME_SIZE;
  const fill = boxArea(points, recentring.factor) / (DRAWING_SIZE * DRAWING_SIZE);
  const elongation = boxElongation(points);
  const spread =
    (recentring.factor * inkRadius(candidate.strokes, recentring.from)) / DRAWING_RADIUS;
  const legibility = letterLegibility(candidate);
  const deficits = legibility.reduce((sum, letter) => sum + letter.deficit, 0);
  const penalty =
    (BALANCE_WEIGHT * centreOffset) / MAX_CENTRE_OFFSET_RATIO +
    FILL_WEIGHT * (1 - fill) +
    (SHRINK_WEIGHT * Math.max(0, MIN_SPREAD - spread)) / MIN_SPREAD +
    LEGIBILITY_WEIGHT * deficits +
    ELONGATION_WEIGHT * (elongation - 1);
  return { centreOffset, fill, spread, elongation, legibility, penalty };
}

/**
 * Picks the best-balanced candidate.
 *
 * @param candidates - Candidates in draw order, at least one.
 * @returns The index of the lowest penalty (the first one on ties) and the
 *   scores of every candidate, in draw order.
 * @throws {RangeError} When `candidates` is empty.
 */
export function chooseCandidate(candidates: readonly SpareCandidate[]): {
  readonly index: number;
  readonly scores: readonly CandidateScore[];
} {
  if (candidates.length === 0) throw new RangeError('Cannot choose among zero candidates.');
  const scores = candidates.map(scoreCandidate);
  let index = 0;
  scores.forEach((score, current) => {
    const best = scores[index];
    if (best !== undefined && score.penalty < best.penalty) index = current;
  });
  return { index, scores };
}

/**
 * Computes the move that puts a drawing's centre of gravity on the frame
 * centre at the largest size that keeps every point within `DRAWING_RADIUS`
 * of it (hence within the margin and the framing circle).
 *
 * @param strokes - Polylines whose centre of gravity is used.
 * @param envelope - Points that must stay in the frame after the move; they
 *   include the points of `strokes`, possibly more (such as the unmerged letters).
 * @returns The recentring; a drawing of null length keeps the frame centre and scale 1.
 */
export function recentringFor(
  strokes: readonly (readonly Point[])[],
  envelope: readonly Point[],
): Recentring {
  const from = centreOfGravity(strokeSegments(strokes)) ?? FRAME_CENTRE;
  let reach = 0;
  for (const point of envelope) reach = Math.max(reach, distance(point, from));
  return { from, factor: reach === 0 ? 1 : DRAWING_RADIUS / reach };
}

/**
 * Applies a recentring to polylines and rounds the coordinates.
 *
 * @param strokes - Polylines to move.
 * @param recentring - Move from `recentringFor`.
 * @returns New polylines; consecutive points made equal by rounding are dropped.
 */
export function applyRecentring(
  strokes: readonly (readonly Point[])[],
  recentring: Recentring,
): Point[][] {
  const { from, factor } = recentring;
  return strokes.map((stroke) => {
    const moved: Point[] = [];
    for (const point of stroke) {
      const next = {
        x: roundCoordinate(FRAME_CENTRE.x + (point.x - from.x) * factor),
        y: roundCoordinate(FRAME_CENTRE.y + (point.y - from.y) * factor),
      };
      const last = moved[moved.length - 1];
      if (last?.x !== next.x || last.y !== next.y) moved.push(next);
    }
    return moved;
  });
}

/**
 * Root-mean-square distance of the ink from a point, every stretch of stroke
 * weighted by its length (exact second moment of each segment).
 *
 * @param strokes - Polylines of the drawing.
 * @param centre - Point the distances are measured from.
 * @returns The distance in frame units, 0 for a drawing without length.
 */
function inkRadius(strokes: readonly (readonly Point[])[], centre: Point): number {
  let length = 0;
  let moment = 0;
  for (const { start, end } of strokeSegments(strokes)) {
    const ax = start.x - centre.x;
    const ay = start.y - centre.y;
    const bx = end.x - centre.x;
    const by = end.y - centre.y;
    const segment = Math.hypot(bx - ax, by - ay);
    length += segment;
    moment += (segment * (ax * ax + ay * ay + ax * bx + ay * by + bx * bx + by * by)) / 3;
  }
  return length === 0 ? 0 : Math.sqrt(moment / length);
}

/**
 * Elongation of the bounding box of points.
 *
 * @param points - Points of the drawing.
 * @returns The larger side over the smaller one, at least 1; 1 without
 *   extent, and `MAX_ELONGATION` for a flat drawing (a lone I), so that the
 *   penalty stays a finite number in the explanation step.
 */
function boxElongation(points: readonly Point[]): number {
  if (points.length === 0) return 1;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const shorter = Math.min(width, height);
  const longer = Math.max(width, height);
  if (longer === 0) return 1;
  return Math.min(MAX_ELONGATION, longer / shorter);
}

/**
 * Area of the bounding box of points once scaled.
 *
 * @param points - Points of the drawing.
 * @param factor - Uniform scale applied by the recentring.
 * @returns Width × height after scaling, in square frame units.
 */
function boxArea(points: readonly Point[], factor: number): number {
  if (points.length === 0) return 0;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = (Math.max(...xs) - Math.min(...xs)) * factor;
  const height = (Math.max(...ys) - Math.min(...ys)) * factor;
  return width * height;
}
