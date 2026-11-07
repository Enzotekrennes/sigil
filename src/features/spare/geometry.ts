/**
 * Plane geometry shared by the Spare scoring and simplification: rounding of
 * frame coordinates, segments of polylines, distances between segments and the
 * centre of gravity of a drawing.
 *
 * Pure functions on points of the 0–100 frame (y downwards). Knows nothing of
 * letters, candidates or scores.
 */
import type { Point } from '../sigil/types.ts';

/**
 * Decimals kept on frame coordinates: 1/10 000 of the frame is far below a
 * printed hair-line, and rounding keeps SVG output short and points on the
 * margin exactly on it.
 */
const COORDINATE_DECIMALS = 4;

/** Length below which a vector counts as null, far under any visible distance. */
const EPSILON = 1e-9;

/** A straight piece of a polyline, from `start` to `end`. */
export interface Segment {
  readonly start: Point;
  readonly end: Point;
}

/**
 * Rounds a frame coordinate to `COORDINATE_DECIMALS` decimals.
 *
 * @param value - Coordinate in frame units.
 * @returns The rounded value, with −0 turned into 0 so equal shapes compare equal.
 */
export function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor + 0;
}

/**
 * Splits polylines into their segments, in drawing order.
 *
 * @param strokes - Polylines; a stroke of fewer than two points gives no segment.
 * @returns Every segment, stroke after stroke, zero-length ones included.
 */
export function strokeSegments(strokes: readonly (readonly Point[])[]): Segment[] {
  const segments: Segment[] = [];
  for (const stroke of strokes) {
    for (let index = 1; index < stroke.length; index += 1) {
      const start = stroke[index - 1];
      const end = stroke[index];
      if (start !== undefined && end !== undefined) segments.push({ start, end });
    }
  }
  return segments;
}

/**
 * Euclidean distance between two points.
 *
 * @param a - First point.
 * @param b - Second point.
 * @returns The distance in frame units.
 */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Length of a segment.
 *
 * @param segment - Any segment.
 * @returns Its length in frame units.
 */
export function segmentLength(segment: Segment): number {
  return distance(segment.start, segment.end);
}

/**
 * Shortest distance from a point to a segment (not to its infinite line).
 *
 * @param point - Any point.
 * @param segment - Any segment; a zero-length one acts as a point.
 * @returns The distance in frame units.
 */
export function pointSegmentDistance(point: Point, segment: Segment): number {
  const { start, end } = segment;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const squared = dx * dx + dy * dy;
  if (squared < EPSILON) return distance(point, start);
  const t = Math.min(
    1,
    Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / squared),
  );
  return distance(point, { x: start.x + t * dx, y: start.y + t * dy });
}

/**
 * Shortest distance between two segments: zero when they cross or touch.
 *
 * @param a - First segment.
 * @param b - Second segment.
 * @returns The distance in frame units.
 */
export function segmentDistance(a: Segment, b: Segment): number {
  if (segmentsCross(a, b)) return 0;
  return Math.min(
    pointSegmentDistance(a.start, b),
    pointSegmentDistance(a.end, b),
    pointSegmentDistance(b.start, a),
    pointSegmentDistance(b.end, a),
  );
}

/**
 * Whether two segments cross strictly, each one's endpoints lying on both
 * sides of the other's line. Touching and collinear cases are left to the
 * endpoint distances of `segmentDistance`.
 *
 * @param a - First segment.
 * @param b - Second segment.
 * @returns True on a proper crossing.
 */
function segmentsCross(a: Segment, b: Segment): boolean {
  const d1 = cross(b.start, b.end, a.start);
  const d2 = cross(b.start, b.end, a.end);
  const d3 = cross(a.start, a.end, b.start);
  const d4 = cross(a.start, a.end, b.end);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * Orientation of `point` relative to the line from `origin` to `towards`.
 *
 * @param origin - Start of the line.
 * @param towards - Second point of the line.
 * @param point - Point to locate.
 * @returns The z component of the cross product: its sign tells the side,
 *   zero means collinear.
 */
function cross(origin: Point, towards: Point, point: Point): number {
  return (
    (towards.x - origin.x) * (point.y - origin.y) - (towards.y - origin.y) * (point.x - origin.x)
  );
}

/**
 * Centre of gravity of a line drawing: the mean of segment midpoints weighted
 * by segment length, as if the ink were spread evenly along the strokes.
 *
 * @param segments - Segments of the drawing.
 * @returns The centre of gravity, or `undefined` when the total length is null.
 */
export function centreOfGravity(segments: readonly Segment[]): Point | undefined {
  let total = 0;
  let x = 0;
  let y = 0;
  for (const segment of segments) {
    const length = segmentLength(segment);
    total += length;
    x += length * ((segment.start.x + segment.end.x) / 2);
    y += length * ((segment.start.y + segment.end.y) / 2);
  }
  if (total < EPSILON) return undefined;
  return { x: x / total, y: y / total };
}
