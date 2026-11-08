/**
 * Plane geometry shared by the Spare scoring, hatch search and
 * simplification: rounding of frame coordinates, segments of polylines,
 * distances and lengths.
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
