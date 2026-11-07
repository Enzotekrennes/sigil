/**
 * Pure geometry used to draw and animate a sigil: SVG path data of a
 * polyline, end points of the end bar, polyline lengths, the timing
 * schedule of the tracing animation and the cap on its total duration.
 *
 * Lengths are computed from the model instead of `getTotalLength()`, so the
 * schedule is known before the SVG exists and can be tested without a
 * browser layout engine. Nothing here touches the DOM or styling.
 */
import type { EndBarMark, Point } from './types.ts';

/**
 * Decimals kept in SVG coordinates: a thousandth of the 0–100 frame is far
 * below a pixel even on a 4096 px export, and keeps the markup short.
 */
const COORDINATE_DECIMALS = 3;

/**
 * Tracing time of the strokes at full speed, in ms: `--duration-trace` of
 * tokens.css (a test keeps both equal).
 */
export const TRACE_DURATION_MS = 2400;

/** Pause between two strokes at full speed, in ms: `--duration-pen-lift` of tokens.css. */
export const PEN_LIFT_MS = 80;

/**
 * Longest tracing, strokes and pen lifts together, in ms: `--duration-trace-max`
 * of tokens.css. With the 150 ms fade of the start mark before and of the end
 * mark after, a sigil is complete within 3 s whatever its number of strokes
 * (the framing circle, when on, adds its own 600 ms). The kamea path (2.4 s,
 * no pen lift) and Spare sigils of up to four strokes keep their full speed.
 */
export const TRACE_MAX_MS = 2700;

/** Share of the tracing given to one stroke, and where it starts. */
export interface StrokeTiming {
  /** Fraction of the total tracing time spent on this stroke, in [0, 1]. */
  readonly share: number;
  /** Fraction of the total tracing time elapsed before this stroke starts, in [0, 1]. */
  readonly offset: number;
  /** Number of pen lifts (pauses between strokes) before this stroke starts. */
  readonly penLiftsBefore: number;
}

/**
 * Writes a coordinate for SVG markup, rounded and without trailing zeros.
 *
 * @param value - Coordinate in frame units.
 * @returns The shortest decimal string at `COORDINATE_DECIMALS` precision
 *   (`-0` is written `0`).
 */
export function formatCoordinate(value: number): string {
  const rounded = Number(value.toFixed(COORDINATE_DECIMALS));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/**
 * Builds the `d` attribute of one polyline: a single move-to then line-tos,
 * so the whole stroke is one SVG path drawn in the path's order.
 *
 * @param points - Points of the polyline in tracing order.
 * @returns SVG path data such as `M10 20L30 40`, or an empty string when
 *   there is no point.
 */
export function polylinePathData(points: readonly Point[]): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${formatCoordinate(point.x)} ${formatCoordinate(point.y)}`,
    )
    .join('');
}

/**
 * Length of a polyline, sum of its segment lengths.
 *
 * @param points - Points of the polyline in order.
 * @returns The length in frame units; 0 for fewer than two points.
 */
export function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    if (from === undefined || to === undefined) continue;
    total += Math.hypot(to.x - from.x, to.y - from.y);
  }
  return total;
}

/**
 * Splits the tracing time between the strokes in proportion to their length,
 * so the pen moves at the same speed on every stroke, in tracing order.
 *
 * @param strokes - Polylines of the sigil in tracing order.
 * @returns One timing per stroke, in the same order. Shares sum to 1 when the
 *   total length is positive; when it is 0, every stroke gets an equal share
 *   so the animation still ends.
 */
export function traceSchedule(strokes: readonly (readonly Point[])[]): StrokeTiming[] {
  const lengths = strokes.map(polylineLength);
  const total = lengths.reduce((sum, value) => sum + value, 0);
  let elapsed = 0;
  return lengths.map((value, index) => {
    const share = total > 0 ? value / total : 1 / lengths.length;
    const timing = { share, offset: elapsed, penLiftsBefore: index };
    elapsed += share;
    return timing;
  });
}

/**
 * Factor applied to the tracing time and to every pen lift so that strokes
 * and pauses together never exceed `TRACE_MAX_MS`. Both shrink in the same
 * proportion: the pen keeps its rhythm, only faster, and the order of the
 * strokes does not change.
 *
 * @param strokeCount - Strokes of the sigil, at least 1.
 * @returns 1 while `TRACE_DURATION_MS + PEN_LIFT_MS × (strokeCount − 1)` fits
 *   the cap, otherwise the factor in (0, 1) that brings it to the cap.
 */
export function traceTimeScale(strokeCount: number): number {
  const penLifts = Math.max(strokeCount - 1, 0);
  const natural = TRACE_DURATION_MS + PEN_LIFT_MS * penLifts;
  return Math.min(1, TRACE_MAX_MS / natural);
}

/**
 * End points of the end bar, centred on its `center` along its `angle`.
 *
 * @param bar - End bar mark.
 * @param length - Length to draw, in frame units (the mark's own length once
 *   resized to the stroke width).
 * @returns The two ends of the bar.
 */
export function endBarEndpoints(bar: EndBarMark, length: number): readonly [Point, Point] {
  const radians = (bar.angle * Math.PI) / 180;
  const half = length / 2;
  const dx = Math.cos(radians) * half;
  const dy = Math.sin(radians) * half;
  return [
    { x: bar.center.x - dx, y: bar.center.y - dy },
    { x: bar.center.x + dx, y: bar.center.y + dy },
  ];
}
