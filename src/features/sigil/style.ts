/**
 * Style settings of the sigil renderer: default `StyleOptions`, the range,
 * step and wording level of the stroke width setting, the framing circle
 * geometry, the SVG line cap and join for each setting, the resizing of
 * marks to the chosen stroke width (up to their cap) and the placement of the
 * loop of a path's last cell, clear of the end bar.
 *
 * Pure values and functions; colours are not here, they come from the CSS
 * tokens (see `SigilRenderer.css`).
 */
import { MARK_REFERENCE_STROKE_WIDTH } from './frame.ts';
import type { Box, LoopMark, Mark, Point, StyleOptions } from './types.ts';

// Re-exported so that the renderer's public API keeps offering it; the value lives in `frame.ts`.
export { MARK_REFERENCE_STROKE_WIDTH };

/**
 * Framing circle radius in frame units: 460 in the design's 1000-unit frame,
 * just outside the 800-unit drawing area so it never touches the marks.
 */
export const FRAME_CIRCLE_RADIUS = 46;

/** Settings of a freshly displayed sigil, from the "Sigil stroke" section of the design. */
export const DEFAULT_STYLE_OPTIONS: StyleOptions = {
  strokeWidth: MARK_REFERENCE_STROKE_WIDTH,
  roundEnds: true,
  frameCircle: false,
  mode: 'screen',
};

/**
 * Thinnest stroke offered by the width setting, in frame units: 4 in the
 * design's 1000-unit frame, the finest line that still reads on a phone.
 */
export const STROKE_WIDTH_MIN = 0.4;

/**
 * Thickest stroke offered by the width setting, in frame units: 40 in the
 * design's 1000-unit frame, a bold line that still leaves the cells apart.
 */
export const STROKE_WIDTH_MAX = 4;

/** Step of the width setting, in frame units: 2 in the design's 1000-unit frame. */
export const STROKE_WIDTH_STEP = 0.2;

/**
 * Widest stroke still called "thin" (fine line, the default 1.2 included),
 * in frame units: 14 in the design's 1000-unit frame.
 */
const THIN_STROKE_MAX = 1.4;

/** Widest stroke still called "medium"; anything wider is "thick". 26 in the design's frame. */
const MEDIUM_STROKE_MAX = 2.6;

/** How a stroke width is described next to the slider. */
export type StrokeWidthLevel = 'thin' | 'medium' | 'thick';

/**
 * Brings any width onto the setting's grid: clamped to
 * [`STROKE_WIDTH_MIN`, `STROKE_WIDTH_MAX`] and rounded to the nearest
 * `STROKE_WIDTH_STEP`, without the binary noise of `0.2 * 7`.
 *
 * @param width - Width in frame units, as read from the slider; `NaN` gives the default.
 * @returns A width the setting offers, with at most one decimal.
 */
export function snapStrokeWidth(width: number): number {
  if (Number.isNaN(width)) return DEFAULT_STYLE_OPTIONS.strokeWidth;
  const clamped = Math.min(Math.max(width, STROKE_WIDTH_MIN), STROKE_WIDTH_MAX);
  const steps = Math.round(clamped / STROKE_WIDTH_STEP);
  // Rounding to one decimal removes the float error of the multiplication (1.4000000000000001).
  return Math.round(steps * STROKE_WIDTH_STEP * 10) / 10;
}

/**
 * Word for a stroke width, shown with its value ("fin", "moyen", "épais").
 *
 * @param width - Width in frame units.
 * @returns `thin` up to 1.4, `medium` up to 2.6, `thick` above.
 */
export function strokeWidthLevel(width: number): StrokeWidthLevel {
  if (width <= THIN_STROKE_MAX) return 'thin';
  if (width <= MEDIUM_STROKE_MAX) return 'medium';
  return 'thick';
}

/**
 * Miter limit used with flat ends: the design's `stroke-miterlimit="4"`,
 * which bevels the sharpest kamea turns instead of drawing long spikes.
 */
const MITER_LIMIT = 4;

/** SVG presentation attributes for the line ends and joins of one setting. */
export interface LineEnds {
  readonly strokeLinecap: 'round' | 'butt';
  readonly strokeLinejoin: 'round' | 'miter';
  /** Only set for mitred joins. */
  readonly strokeMiterlimit?: number;
}

/**
 * Line cap and join for the `roundEnds` setting, as the design specifies.
 *
 * @param roundEnds - `StyleOptions.roundEnds`.
 * @returns `round` + `round`, or `butt` + `miter` with a miter limit of 4.
 */
export function lineEndsFor(roundEnds: boolean): LineEnds {
  if (roundEnds) return { strokeLinecap: 'round', strokeLinejoin: 'round' };
  return { strokeLinecap: 'butt', strokeLinejoin: 'miter', strokeMiterlimit: MITER_LIMIT };
}

/**
 * Whether the framing circle is drawn: never in stencil mode, which keeps a
 * single line without decoration.
 *
 * @param options - Style settings.
 * @returns True when the circle must be rendered.
 */
export function showsFrameCircle(options: StyleOptions): boolean {
  return options.frameCircle && options.mode !== 'stencil';
}

/**
 * Centre of the frame, where the framing circle is drawn.
 *
 * @param viewBox - Frame of the sigil.
 * @returns The middle of the box.
 */
export function frameCenter(viewBox: Box): Point {
  return { x: viewBox.x + viewBox.width / 2, y: viewBox.y + viewBox.height / 2 };
}

/**
 * Widest paper gap kept between the end loop and the end bar, in frame units:
 * one reference stroke width. Below that width the gap equals the stroke
 * width; above it the gap stops growing, so that at the thickest stroke (4)
 * the loop, its clearance and its radius still fit beside a last segment one
 * Moon cell long (8.9 units).
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
 * Resizes a mark so it keeps its proportions to the stroke, up to the cap
 * its method set: marks are sized by the methods for
 * `MARK_REFERENCE_STROKE_WIDTH` and follow the stroke width until they reach
 * their `maxRadius` or `maxLength` (the kamea method sets them relative to its
 * cells, so thick strokes do not blow marks over the neighbouring cells).
 *
 * Circles and bars stay anchored where the path is: the start circle and the
 * end bar keep their centre; a loop keeps its anchor and still touches the
 * path, its centre moved along the same normal. The loop of the last cell
 * (`lastSegment` set) is placed again with `placeEndLoop`, so its clearance
 * from the end bar follows the actual stroke width.
 *
 * @param mark - Mark as produced by the method.
 * @param strokeWidth - Chosen stroke width in frame units, positive.
 * @returns A new mark with radius or length scaled by
 *   `strokeWidth / MARK_REFERENCE_STROKE_WIDTH`, capped, and its loop centre
 *   moved accordingly.
 */
export function scaleMark(mark: Mark, strokeWidth: number): Mark {
  const factor = strokeWidth / MARK_REFERENCE_STROKE_WIDTH;
  switch (mark.kind) {
    case 'start-circle':
      return { ...mark, radius: capped(mark.radius * factor, mark.maxRadius) };
    case 'end-bar':
      return { ...mark, length: capped(mark.length * factor, mark.maxLength) };
    case 'loop':
      return scaleLoop(mark, capped(mark.radius * factor, mark.maxRadius), strokeWidth);
  }
}

/**
 * Applies an optional upper bound.
 *
 * @param value - Value to bound.
 * @param max - Upper bound, or `undefined` for none.
 * @returns `value`, or `max` when it is smaller.
 */
function capped(value: number, max: number | undefined): number {
  return max === undefined ? value : Math.min(value, max);
}

/**
 * Gives a loop a new radius and moves its centre so it keeps touching the path.
 *
 * @param loop - Loop as produced by the method, at the reference width.
 * @param radius - New radius in frame units, positive.
 * @param strokeWidth - Stroke width in frame units, for the end loop's clearance.
 * @returns The resized loop.
 */
function scaleLoop(loop: LoopMark, radius: number, strokeWidth: number): LoopMark {
  const offset = { x: loop.center.x - loop.anchor.x, y: loop.center.y - loop.anchor.y };
  const { lastSegment } = loop;
  if (lastSegment === undefined) {
    const ratio = radius / loop.radius;
    return {
      ...loop,
      radius,
      center: { x: loop.anchor.x + offset.x * ratio, y: loop.anchor.y + offset.y * ratio },
    };
  }
  return {
    ...loop,
    radius,
    center: placeEndLoop(
      loop.anchor,
      lastSegment,
      loopSide(lastSegment, offset),
      radius,
      strokeWidth,
    ),
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
