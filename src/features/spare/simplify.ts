/**
 * Merging and simplification of the strokes of a Spare rune, once the stem
 * and the letters are placed: points that nearly coincide become one, a segment
 * drawn again over (or right beside) an earlier one is drawn only once, and
 * straight runs lose their useless middle points.
 *
 * Exposes `simplifyStrokes` and its tolerances. The shape is kept: a point
 * snapped onto an earlier one moves by at most `POINT_MERGE_TOLERANCE`; a
 * long straight stroke is dropped only where another one runs within
 * `STRAIGHT_MERGE_TOLERANCE` of it, and the end of the piece left over is
 * joined to the covering stroke's endpoint, so it moves by at most
 * `STRAIGHT_MERGE_TOLERANCE` too; stroke order is preserved (the tracing
 * animation follows it). Does not score, recentre or round.
 */
import type { Point } from '../sigil/types.ts';
import { distance, strokeSegments } from './geometry.ts';
import type { Segment } from './geometry.ts';

/**
 * Distance under which two points, or a segment and the line of another, are
 * merged, in frame units. Under half the default stroke width (1.2), so that
 * what is merged already looked like a single line once drawn.
 */
export const POINT_MERGE_TOLERANCE = 0.5;

/**
 * Deviation under which a middle point of a polyline counts as lying on the
 * straight line between its neighbours, in frame units. About a thousandth
 * of the default stroke width (1.2): only points that change nothing visible
 * are dropped.
 */
export const STRAIGHT_TOLERANCE = 1e-3;

/**
 * Distance under which two long straight segments lying along the same line
 * are merged, in frame units: 1.25 default stroke widths. Parallel bars and
 * stems that close leave a gap thinner than the stroke itself and read as one
 * blurred, doubled line rather than two; merging them sharpens the seal.
 */
export const STRAIGHT_MERGE_TOLERANCE = 1.5;

/**
 * Shortest segment the wider `STRAIGHT_MERGE_TOLERANCE` applies to, in frame
 * units. Curves of the Hershey skeletons are made of segments of 1–4 units at
 * sigil size; bars and stems are longer. Keeping curves on the strict
 * tolerance stops two nearby arcs from being cut into dashes.
 */
export const MIN_STRAIGHT_LENGTH = 6;

/** Result of `simplifyStrokes`. */
export interface SimplifiedStrokes {
  /** Polylines in the original drawing order, each with at least two distinct points. */
  readonly strokes: Point[][];
  /** Number of segments before simplification, zero-length ones included. */
  readonly segmentCountBefore: number;
  /** Number of segments after simplification. */
  readonly segmentCountAfter: number;
}

/** A segment kept in the output, with the index of the input stroke it comes from. */
interface KeptSegment extends Segment {
  readonly stroke: number;
}

/**
 * Merges and simplifies placed strokes, in four passes:
 * 1. points closer than `POINT_MERGE_TOLERANCE` to an earlier point are
 *    replaced by it (first one wins, so the result is deterministic);
 * 2. each segment, in drawing order, loses the parts already drawn by an
 *    earlier collinear segment (both within `POINT_MERGE_TOLERANCE` of each
 *    other's line, or `STRAIGHT_MERGE_TOLERANCE` when both are at least
 *    `MIN_STRAIGHT_LENGTH` long): duplicates vanish and overlapping collinear
 *    segments end up drawn once, as their union; leftovers shorter than
 *    `POINT_MERGE_TOLERANCE` go. A piece cut where a covering segment ends is
 *    joined to that segment's endpoint, so that merged lines meet without a step;
 * 3. the same subtraction again, without that joining: a joined piece may
 *    have landed on a segment already drawn, and this pass guarantees that no
 *    two output segments overlap along the same line;
 * 4. middle points lying on a straight run are removed.
 *
 * @param strokes - Polylines in the 0–100 frame, in drawing order.
 * @returns The simplified polylines (an input stroke may be split where a part
 *   of it was already drawn, or vanish entirely) and the segment counts.
 */
export function simplifyStrokes(strokes: readonly (readonly Point[])[]): SimplifiedStrokes {
  const segmentCountBefore = strokeSegments(strokes).length;
  const snapped = snapPoints(strokes);

  const joined: KeptSegment[] = [];
  snapped.forEach((stroke, strokeIndex) => {
    for (const segment of strokeSegments([stroke])) {
      for (const piece of uncoveredPieces(segment, joined, true)) {
        joined.push({ ...piece, stroke: strokeIndex });
      }
    }
  });

  const kept: KeptSegment[] = [];
  for (const segment of joined) {
    for (const piece of uncoveredPieces(segment, kept, false)) {
      kept.push({ ...piece, stroke: segment.stroke });
    }
  }

  const polylines = chainSegments(kept).map(removeStraightPoints);
  const segmentCountAfter = polylines.reduce((count, line) => count + line.length - 1, 0);
  return { strokes: polylines, segmentCountBefore, segmentCountAfter };
}

/**
 * Replaces every point by the first earlier point within
 * `POINT_MERGE_TOLERANCE`, then drops repeated consecutive points.
 *
 * @param strokes - Polylines as drawn.
 * @returns The same polylines on the merged points; a stroke may shrink to
 *   one point (it then yields no segment).
 */
function snapPoints(strokes: readonly (readonly Point[])[]): Point[][] {
  const representatives: Point[] = [];
  return strokes.map((stroke) => {
    const snapped: Point[] = [];
    for (const point of stroke) {
      let representative = representatives.find(
        (candidate) =>
          // The axis test skips the square root for the many points far apart.
          Math.abs(candidate.x - point.x) <= POINT_MERGE_TOLERANCE &&
          Math.abs(candidate.y - point.y) <= POINT_MERGE_TOLERANCE &&
          distance(candidate, point) <= POINT_MERGE_TOLERANCE,
      );
      if (representative === undefined) {
        representative = point;
        representatives.push(point);
      }
      if (snapped[snapped.length - 1] !== representative) snapped.push(representative);
    }
    return snapped;
  });
}

/** A stretch of a segment, by distance from its start, with the points to draw its ends at. */
interface Stretch {
  readonly from: number;
  readonly to: number;
  /** Point to start at, when it is not the point of the segment at `from`. */
  readonly fromPoint?: Point;
  /** Point to end at, when it is not the point of the segment at `to`. */
  readonly toPoint?: Point;
}

/**
 * Removes from a segment the parts that earlier collinear segments already draw.
 *
 * @param segment - Segment to add, of positive length.
 * @param kept - Segments already in the output.
 * @param joinCovers - When true, a piece cut where a covering segment ends
 *   starts (or stops) on that segment's endpoint, so that merged lines join
 *   without a step; when false, it stays on `segment`'s own line.
 * @returns The uncovered pieces in order from `segment.start`, each at least
 *   `POINT_MERGE_TOLERANCE` long. A piece reaching an end of `segment` keeps
 *   that exact endpoint, which keeps chains connected.
 */
function uncoveredPieces(
  segment: Segment,
  kept: readonly Segment[],
  joinCovers: boolean,
): Segment[] {
  const length = distance(segment.start, segment.end);
  if (length === 0) return [];
  const direction = {
    x: (segment.end.x - segment.start.x) / length,
    y: (segment.end.y - segment.start.y) / length,
  };
  const along = (point: Point): number =>
    (point.x - segment.start.x) * direction.x + (point.y - segment.start.y) * direction.y;

  const covered: Stretch[] = kept
    .filter((other) => areCollinear(segment, other))
    .map((other) => {
      const [near, far] =
        along(other.start) <= along(other.end)
          ? [other.start, other.end]
          : [other.end, other.start];
      const from = along(near);
      const to = along(far);
      return {
        from: Math.max(0, from),
        to: Math.min(length, to),
        ...(joinCovers && from > 0 ? { fromPoint: near } : {}),
        ...(joinCovers && to < length ? { toPoint: far } : {}),
      };
    })
    .filter((stretch) => stretch.to > stretch.from)
    .sort((a, b) => a.from - b.from);

  const free: Stretch[] = [];
  let cursor = 0;
  let cursorPoint: Point | undefined;
  for (const stretch of covered) {
    if (stretch.from > cursor) {
      free.push({
        from: cursor,
        to: stretch.from,
        ...(cursorPoint ? { fromPoint: cursorPoint } : {}),
        ...(stretch.fromPoint ? { toPoint: stretch.fromPoint } : {}),
      });
    }
    if (stretch.to >= cursor) {
      cursor = stretch.to;
      cursorPoint = stretch.toPoint;
    }
  }
  if (cursor < length)
    free.push({ from: cursor, to: length, ...(cursorPoint ? { fromPoint: cursorPoint } : {}) });

  const pointAt = (t: number): Point => {
    if (t === 0) return segment.start;
    if (t === length) return segment.end;
    return { x: segment.start.x + direction.x * t, y: segment.start.y + direction.y * t };
  };
  return free
    .filter((piece) => piece.to - piece.from >= POINT_MERGE_TOLERANCE)
    .map((piece) => ({
      start: piece.fromPoint ?? pointAt(piece.from),
      end: piece.toPoint ?? pointAt(piece.to),
    }));
}

/**
 * Whether two segments lie on the same line: both ends of the shorter one
 * are within the merge tolerance of the longer one's line
 * (`STRAIGHT_MERGE_TOLERANCE` when both are at least `MIN_STRAIGHT_LENGTH`
 * long, `POINT_MERGE_TOLERANCE` otherwise). The shorter one then runs along
 * the longer one, never further from it than the tolerance, so drawing their
 * shared stretch once changes nothing visible.
 *
 * @param a - First segment, of positive length.
 * @param b - Second segment.
 * @returns True when they are collinear (overlap is not checked here).
 */
function areCollinear(a: Segment, b: Segment): boolean {
  const lengthA = distance(a.start, a.end);
  const lengthB = distance(b.start, b.end);
  const bothStraight = lengthA >= MIN_STRAIGHT_LENGTH && lengthB >= MIN_STRAIGHT_LENGTH;
  const tolerance = bothStraight ? STRAIGHT_MERGE_TOLERANCE : POINT_MERGE_TOLERANCE;
  const [shorter, longer] = lengthA <= lengthB ? [a, b] : [b, a];
  return (
    lineDistance(shorter.start, longer) <= tolerance &&
    lineDistance(shorter.end, longer) <= tolerance
  );
}

/**
 * Distance from a point to the infinite line through a segment.
 *
 * @param point - Any point.
 * @param segment - Segment giving the line; a zero-length one acts as a point.
 * @returns The distance in frame units.
 */
function lineDistance(point: Point, segment: Segment): number {
  const length = distance(segment.start, segment.end);
  if (length === 0) return distance(point, segment.start);
  const { start, end } = segment;
  return (
    Math.abs((end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x)) /
    length
  );
}

/**
 * Joins kept segments back into polylines: consecutive segments of the same
 * input stroke sharing an endpoint form one polyline.
 *
 * @param segments - Kept segments in drawing order.
 * @returns Polylines in the same order, each with at least two points.
 */
function chainSegments(segments: readonly KeptSegment[]): Point[][] {
  const polylines: Point[][] = [];
  let current: Point[] | undefined;
  let previous: KeptSegment | undefined;
  for (const segment of segments) {
    if (
      current !== undefined &&
      previous?.stroke === segment.stroke &&
      previous.end === segment.start
    ) {
      current.push(segment.end);
    } else {
      current = [segment.start, segment.end];
      polylines.push(current);
    }
    previous = segment;
  }
  return polylines;
}

/**
 * Drops the middle points of straight runs: a point is removed when it lies
 * within `STRAIGHT_TOLERANCE` of the line from the last kept point to the
 * next point, between them.
 *
 * @param polyline - Points of one polyline, at least two, no consecutive repeats.
 * @returns The polyline with the same shape and fewer points.
 */
function removeStraightPoints(polyline: readonly Point[]): Point[] {
  const first = polyline[0];
  if (first === undefined) return [];
  const result: Point[] = [first];
  for (let index = 1; index < polyline.length; index += 1) {
    const point = polyline[index];
    const next = polyline[index + 1];
    const last = result[result.length - 1];
    if (point === undefined || last === undefined) continue;
    if (next !== undefined && liesBetween(point, last, next)) continue;
    result.push(point);
  }
  return result;
}

/**
 * Whether a point lies on the segment between two others, within `STRAIGHT_TOLERANCE`.
 *
 * @param point - Candidate middle point.
 * @param from - Previous point.
 * @param to - Next point.
 * @returns True when removing `point` leaves the drawing unchanged.
 */
function liesBetween(point: Point, from: Point, to: Point): boolean {
  const forward = (point.x - from.x) * (to.x - point.x) + (point.y - from.y) * (to.y - point.y);
  return forward > 0 && lineDistance(point, { start: from, end: to }) <= STRAIGHT_TOLERANCE;
}
