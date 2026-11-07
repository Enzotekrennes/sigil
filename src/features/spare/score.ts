/**
 * Balance score of the Spare candidates and the final recentring: rates how
 * well a composition sits in the frame as a seal (centre of gravity, use of
 * the drawing area, every letter caught in the others, no letter left
 * upright), and moves the chosen one so that its centre of gravity lands on
 * the centre of the frame.
 *
 * Exposes `scoreCandidate`, `chooseCandidate`, `recentringFor`,
 * `applyRecentring`, the weights of the score and the `CandidateScore` type.
 * Pure and deterministic. Does not merge or simplify strokes.
 */
import { DRAWING_SIZE, FRAME_SIZE } from '../sigil/frame.ts';
import type { Point } from '../sigil/types.ts';
import type { SpareCandidate } from './generateSpareCandidates.ts';
import {
  centreOfGravity,
  distance,
  roundCoordinate,
  segmentDistance,
  strokeSegments,
} from './geometry.ts';
import type { Segment } from './geometry.ts';
import { looksUpright } from './placement.ts';

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
 * Weight of the isolation term: every letter touching no other letter
 * costs `ISOLATION_WEIGHT / letterCount`. A letter that stands apart stays
 * readable on its own, which the method precisely avoids, so a fully
 * separated composition (cost 2) loses against any connected one.
 */
export const ISOLATION_WEIGHT = 2;

/**
 * Weight of the upright term: every letter whose orientation leaves it
 * exactly as written (see `looksUpright`) costs `UPRIGHT_WEIGHT / letterCount`.
 * Superimposed letters still read when one of them stands upright (a P, an M
 * in plain view): this term makes the score prefer turned and reversed
 * letters. One upright letter in five costs 0.3, as much as a 3 % centring
 * gap or a 0.3 loss of fill: enough to steer the choice among the many
 * balanced candidates, not enough to pick a lopsided one. Tuned on the
 * reference board of twelve sigils.
 */
export const UPRIGHT_WEIGHT = 1.5;

/**
 * Distance under which two letters count as touching, in frame units: under
 * half the default stroke width (1.2), where drawn strokes already merge.
 */
export const LETTER_CONTACT_DISTANCE = 0.5;

/** Centre of the frame, where the centre of gravity of the final sigil lands. */
const FRAME_CENTRE: Point = { x: FRAME_SIZE / 2, y: FRAME_SIZE / 2 };

/** Largest distance from the frame centre a point may reach on each axis, staying in the margin. */
const HALF_DRAWING = DRAWING_SIZE / 2;

/** Balance rating of one candidate, every term in its own unit for the explanation panel. */
export interface CandidateScore {
  /**
   * Distance of the centre of gravity from the frame centre, before
   * recentring, as a fraction of the frame side (0.03 = 3 %).
   */
  readonly centreOffset: number;
  /** Share of the drawing area covered by the recentred drawing's bounding box, 0–1. */
  readonly fill: number;
  /** Indices of the letters that touch no other letter, in input order. */
  readonly isolatedLetters: readonly number[];
  /** Indices of the letters drawn exactly as written (identity or a symmetry), in input order. */
  readonly uprightLetters: readonly number[];
  /** Weighted sum of the four penalties; the lowest wins. */
  readonly penalty: number;
}

/** Similarity that moves a drawing's centre of gravity onto the frame centre. */
export interface Recentring {
  /** Centre of gravity before the move, mapped onto the frame centre. */
  readonly from: Point;
  /** Uniform scale around it, so that every point stays within the margin. */
  readonly factor: number;
}

/**
 * Rates one candidate. Lower is better:
 * `BALANCE_WEIGHT × centreOffset / MAX_CENTRE_OFFSET_RATIO
 * + FILL_WEIGHT × (1 − fill) + ISOLATION_WEIGHT × isolated / letterCount
 * + UPRIGHT_WEIGHT × upright / letterCount`.
 *
 * @param candidate - Composition fitted into the frame.
 * @returns The terms of the score and the total penalty.
 */
export function scoreCandidate(candidate: SpareCandidate): CandidateScore {
  const points = candidate.strokes.flat();
  const recentring = recentringFor(candidate.strokes, points);
  const centreOffset = distance(recentring.from, FRAME_CENTRE) / FRAME_SIZE;
  const fill = boxArea(points, recentring.factor) / (DRAWING_SIZE * DRAWING_SIZE);
  const isolatedLetters = findIsolatedLetters(candidate);
  const uprightLetters = candidate.placements.flatMap((placement, index) =>
    looksUpright(placement.letter, placement.mirrored, placement.rotation) ? [index] : [],
  );
  const letterCount = candidate.placements.length;
  const penalty =
    (BALANCE_WEIGHT * centreOffset) / MAX_CENTRE_OFFSET_RATIO +
    FILL_WEIGHT * (1 - fill) +
    (ISOLATION_WEIGHT * isolatedLetters.length) / letterCount +
    (UPRIGHT_WEIGHT * uprightLetters.length) / letterCount;
  return { centreOffset, fill, isolatedLetters, uprightLetters, penalty };
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
 * centre at the largest size that keeps every point within the margin.
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
  for (const point of envelope) {
    reach = Math.max(reach, Math.abs(point.x - from.x), Math.abs(point.y - from.y));
  }
  return { from, factor: reach === 0 ? 1 : HALF_DRAWING / reach };
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
 * Lists the letters none of whose segments comes within
 * `LETTER_CONTACT_DISTANCE` of another letter's segment.
 *
 * @param candidate - Candidate with the owner of each stroke.
 * @returns Letter indices in input order; empty for a single letter, which
 *   has nothing to touch.
 */
function findIsolatedLetters(candidate: SpareCandidate): number[] {
  const letterCount = candidate.placements.length;
  if (letterCount < 2) return [];
  const byLetter: Segment[][] = Array.from({ length: letterCount }, () => []);
  candidate.strokes.forEach((stroke, index) => {
    const owner = candidate.strokeLetters[index];
    if (owner !== undefined) byLetter[owner]?.push(...strokeSegments([stroke]));
  });

  const isolated: number[] = [];
  byLetter.forEach((own, letter) => {
    const touches = byLetter.some(
      (other, otherLetter) =>
        otherLetter !== letter &&
        own.some((segment) =>
          other.some((against) => segmentDistance(segment, against) <= LETTER_CONTACT_DISTANCE),
        ),
    );
    if (!touches) isolated.push(letter);
  });
  return isolated;
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
