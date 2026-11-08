/**
 * Geometry of the marks shared by the methods and the renderer: where the
 * loop of a path's last cell sits, clear of the end bar, for any stroke width.
 * The kamea method places it at the reference width; the renderer and the
 * frame fitting place it again at the chosen width.
 *
 * Exposes `endLoopClearance`, `placeEndLoop` and `loopSide`. Pure functions,
 * free of any rendering concern, so a method can use them without loading the
 * renderer (like the constants of `frame.ts`).
 */
import { MARK_REFERENCE_STROKE_WIDTH } from './frame.ts';
import type { Point } from './types.ts';

/**
 * Widest paper gap kept between the end loop and the end bar, in frame units:
 * one reference stroke width. Below that width the gap equals the stroke
 * width; above it the gap stops growing, so that at the thickest stroke the
 * setting offers (`STROKE_WIDTH_MAX`, 2.4) the loop, its clearance (3.6) and
 * its radius still fit beside a last segment one Moon cell long (8.9 units).
 */
const END_LOOP_GAP_MAX = MARK_REFERENCE_STROKE_WIDTH;

/**
 * Distance from the end bar's axis to the nearest point of the end loop's
 * centre line: half the bar stroke and half the loop stroke (one stroke
 * width), plus a paper gap of one stroke width up to `END_LOOP_GAP_MAX`.
 *
 * @param strokeWidth - Stroke width in frame units, positive.
 * @returns The clearance in frame units: 2.4 at the reference width 1.2.
 */
export function endLoopClearance(strokeWidth: number): number {
  return strokeWidth + Math.min(strokeWidth, END_LOOP_GAP_MAX);
}

/**
 * Centre of the loop of a path's last cell. The loop touches the last segment
 * back from the end point by its radius plus `endLoopClearance`, on the
 * `side` given, so it never touches the end bar that crosses the end point.
 * Shared by the kamea method (at the reference width) and by `scaleMark`.
 *
 * @param end - Last point of the path, the loop's anchor.
 * @param lastSegment - Vector from `end` back to the previous point; not null.
 * @param side - Unit vector perpendicular to `lastSegment`, towards the loop.
 * @param radius - Loop radius in frame units.
 * @param strokeWidth - Stroke width in frame units, positive.
 * @returns The loop centre in frame units.
 */
export function placeEndLoop(
  end: Point,
  lastSegment: Point,
  side: Point,
  radius: number,
  strokeWidth: number,
): Point {
  const length = Math.hypot(lastSegment.x, lastSegment.y);
  const back = (radius + endLoopClearance(strokeWidth)) / length;
  return {
    x: end.x + lastSegment.x * back + side.x * radius,
    y: end.y + lastSegment.y * back + side.y * radius,
  };
}

/**
 * Unit vector across the last segment, on the side where the loop sits.
 *
 * @param lastSegment - Vector from the end point back to the previous point; not null.
 * @param offset - Loop centre minus anchor.
 * @returns The unit normal of `lastSegment` pointing towards `offset`.
 */
export function loopSide(lastSegment: Point, offset: Point): Point {
  const length = Math.hypot(lastSegment.x, lastSegment.y);
  const normal = { x: -lastSegment.y / length, y: lastSegment.x / length };
  const towards = normal.x * offset.x + normal.y * offset.y >= 0;
  return towards ? normal : { x: -normal.x, y: -normal.y };
}
