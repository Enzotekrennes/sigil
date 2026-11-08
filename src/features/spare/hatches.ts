/**
 * Hatches of a Spare rune: two parallel strokes drawn a few stroke widths
 * apart along a common length, which read as a blurred, doubled line (the
 * main flaw of the earlier free superimposition). Finds them, and corrects
 * those a rune still has by laying the shorter stroke onto the longer one,
 * where the merge then draws them once.
 *
 * Exposes `findHatches`, `correctHatches` and the thresholds. Pure functions
 * on points of the 0–100 frame. Does not score: `runeScore.ts` counts hatches.
 */
import type { Point } from '../sigil/types.ts';
import { segmentLength, strokeSegments } from './geometry.ts';
import type { Segment } from './geometry.ts';
import { simplifyStrokes } from './simplify.ts';

/**
 * Smallest gap between two parallel strokes that counts as a hatch, in frame
 * units. Closer than that, the merge draws them as one line (see
 * `POINT_MERGE_TOLERANCE` in `simplify.ts`): they are confounded, not hatched.
 */
export const MIN_HATCH_GAP = 0.5;

/**
 * Largest gap between two parallel strokes that counts as a hatch, in frame
 * units: about four default stroke widths (1.2). Further apart, the white
 * between them reads as space, as between the arms of an E.
 */
export const MAX_HATCH_GAP = 5;

/**
 * Shortest length two parallel strokes must run side by side to make a
 * hatch, in frame units: two and a half stroke widths. Two strokes meeting at
 * a corner run side by side for less than that.
 */
export const MIN_HATCH_OVERLAP = 3;

/** Largest angle between two strokes, in degrees, for them to count as parallel. */
export const HATCH_PARALLEL_ANGLE = 6;

/**
 * Most correction rounds. Laying a stroke onto another moves the strokes
 * joined to it, which can rarely make a new hatch; two rounds clear every
 * case measured on long words, the others are a safety margin.
 */
export const MAX_CORRECTION_ROUNDS = 4;

/** Distance under which a point rests on a segment of another polyline, in frame units. */
const JOINT_DISTANCE = 1e-6;

/**
 * Finds the hatches of a drawing: pairs of segments within
 * `HATCH_PARALLEL_ANGLE` of each other, `MIN_HATCH_GAP`–`MAX_HATCH_GAP`
 * apart, running side by side over at least `MIN_HATCH_OVERLAP`.
 *
 * @param segments - Segments of positive length, in the 0–100 frame.
 * @returns The offending pairs, as indices into `segments`, lower index first.
 */
export function findHatches(segments: readonly Segment[]): [number, number][] {
  const limit = Math.cos((HATCH_PARALLEL_ANGLE * Math.PI) / 180);
  const pairs: [number, number][] = [];
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const a = segments[i];
      const b = segments[j];
      if (a === undefined || b === undefined) continue;
      if (isHatch(a, b, limit)) pairs.push([i, j]);
    }
  }
  return pairs;
}

/**
 * Whether two segments form a hatch (see `findHatches`).
 *
 * @param a - First segment.
 * @param b - Second segment.
 * @param cosineLimit - Cosine of `HATCH_PARALLEL_ANGLE`.
 * @returns True for a hatch.
 */
function isHatch(a: Segment, b: Segment, cosineLimit: number): boolean {
  const [longer, shorter] = segmentLength(a) >= segmentLength(b) ? [a, b] : [b, a];
  const length = segmentLength(longer);
  const ux = (longer.end.x - longer.start.x) / length;
  const uy = (longer.end.y - longer.start.y) / length;
  const shortLength = segmentLength(shorter);
  const vx = (shorter.end.x - shorter.start.x) / shortLength;
  const vy = (shorter.end.y - shorter.start.y) / shortLength;
  if (Math.abs(ux * vx + uy * vy) < cosineLimit) return false;

  const along = (point: Point): number =>
    (point.x - longer.start.x) * ux + (point.y - longer.start.y) * uy;
  const from = Math.max(0, Math.min(along(shorter.start), along(shorter.end)));
  const to = Math.min(length, Math.max(along(shorter.start), along(shorter.end)));
  if (to - from < MIN_HATCH_OVERLAP) return false;

  const across = (point: Point): number =>
    Math.abs((point.x - longer.start.x) * uy - (point.y - longer.start.y) * ux);
  const gap = (across(shorter.start) + across(shorter.end)) / 2;
  return gap >= MIN_HATCH_GAP && gap <= MAX_HATCH_GAP;
}

/**
 * Removes the hatches of merged strokes: for each hatch, the ends of the
 * shorter segment move to their nearest points on the longer one, and every
 * stroke point at the same place moves with them, so strokes sharing a point
 * stay joined. An end resting inside a segment of another polyline (an arm
 * on the stem) is a joint nothing would move with: it stays put. The strokes
 * are then merged again, which draws the now overlapping segments once.
 * Repeated up to `MAX_CORRECTION_ROUNDS` times while hatches remain.
 *
 * @param strokes - Merged polylines in the 0–100 frame.
 * @returns The corrected polylines, each of at least two points; the same
 *   polylines (not a copy) when there was no hatch. Every moved point lands
 *   on an existing segment, so the drawing never grows beyond its convex
 *   hull. A hatch whose shorter segment has both ends resting inside other
 *   strokes is left as it is.
 */
export function correctHatches(
  strokes: readonly (readonly Point[])[],
): readonly (readonly Point[])[] {
  let current = strokes;
  for (let round = 0; round < MAX_CORRECTION_ROUNDS; round += 1) {
    const owned = current.flatMap((stroke, owner) =>
      strokeSegments([stroke])
        .filter((segment) => segmentLength(segment) > 0)
        .map((segment) => ({ segment, owner })),
    );
    const segments = owned.map(({ segment }) => segment);
    const hatches = findHatches(segments);
    if (hatches.length === 0) return current;
    // A joint rests inside a segment of another polyline without being one of
    // its points: moving it would open the joint, as nothing there moves with it.
    const isJoint = (point: Point, owner: number): boolean =>
      owned.some(
        (other) =>
          other.owner !== owner &&
          pointKey(point) !== pointKey(other.segment.start) &&
          pointKey(point) !== pointKey(other.segment.end) &&
          distanceToSegment(point, other.segment) < JOINT_DISTANCE,
      );
    const moves = new Map<string, Point>();
    for (const [i, j] of hatches) {
      const a = owned[i];
      const b = owned[j];
      if (a === undefined || b === undefined) continue;
      const [longer, shorter] =
        segmentLength(a.segment) >= segmentLength(b.segment) ? [a, b] : [b, a];
      const free = [shorter.segment.start, shorter.segment.end].filter(
        (point) => !isJoint(point, shorter.owner),
      );
      for (const point of free) {
        const key = pointKey(point);
        if (!moves.has(key)) moves.set(key, nearestOnSegment(point, longer.segment));
      }
    }
    if (moves.size === 0) return current;
    const moved = current.map((stroke) =>
      stroke.map((point) => moves.get(pointKey(point)) ?? point),
    );
    current = simplifyStrokes(moved).strokes.filter((stroke) => stroke.length >= 2);
  }
  return current;
}

/**
 * Distance from a point to a segment.
 *
 * @param point - Point measured.
 * @param segment - Segment of positive length.
 * @returns The distance in frame units.
 */
function distanceToSegment(point: Point, segment: Segment): number {
  const nearest = nearestOnSegment(point, segment);
  return Math.hypot(point.x - nearest.x, point.y - nearest.y);
}

/**
 * Key of a point's position, so that equal points in different strokes move together.
 *
 * @param point - Any point.
 * @returns Its coordinates as text.
 */
function pointKey(point: Point): string {
  return `${String(point.x)},${String(point.y)}`;
}

/**
 * Nearest point of a segment.
 *
 * @param point - Point projected.
 * @param segment - Segment of positive length.
 * @returns The point of the segment closest to `point`.
 */
function nearestOnSegment(point: Point, segment: Segment): Point {
  const { start, end } = segment;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)),
  );
  return { x: start.x + t * dx, y: start.y + t * dy };
}
