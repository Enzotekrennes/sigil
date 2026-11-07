/**
 * Fits a drawing inside the framing circle.
 *
 * The methods fill the 10–90 drawing square, whose corners lie about 56 units
 * from the centre, beyond the framing circle (radius 46). When the circle is
 * shown, the renderer shrinks the drawing uniformly around the frame centre so
 * that every line, mark included, stays inside the circle with a visible band
 * of paper. Only positions move: stroke width, mark radii and bar lengths keep
 * the chosen size, so the line looks the same, only the shape is smaller. One
 * exception: the loop of the last cell shrinks when the shortened last segment
 * can no longer hold it clear of the end bar.
 *
 * Exposes `frameFitScale` and `scaleDrawing`. Pure functions.
 */
import { endBarEndpoints } from './geometry.ts';
import { FRAME_CIRCLE_RADIUS, loopSide } from './style.ts';
import type { LoopMark, Mark, Point } from './types.ts';

/**
 * Smallest radius the end loop is given when the fitted last segment is too
 * short for it, in frame units, so it never turns into a point. Above any
 * case met by the seven squares at the offered widths (see the kamea tests);
 * reaching it would let the loop pass the previous point of the path.
 */
const END_LOOP_MIN_RADIUS = 0.1;

/**
 * Paper left between the drawing and the framing circle, in stroke widths:
 * two widths read clearly as a gap at every width offered.
 */
const FRAME_GAP_STROKES = 2;

/**
 * Smallest gap in frame units, so the thinnest strokes (0.4) still leave a
 * band visible at phone size (2 units ≈ 7 px on a 343 px scene).
 */
const FRAME_GAP_MIN = 2;

/** Bisection rounds of `frameFitScale`: 2⁻³⁰ precision, far below a pixel. */
const BISECTION_ROUNDS = 30;

/** Lines and marks of a drawing, in frame units. */
export interface Drawing {
  readonly strokes: readonly (readonly Point[])[];
  readonly marks: readonly Mark[];
}

/**
 * Moves every position of the drawing towards `center` by `scale`, keeping
 * the sizes of the marks. A loop keeps touching the path: its centre moves
 * with its anchor; the loop of the last cell stays beside the shortened last
 * segment (see `fitEndLoop`).
 *
 * @param drawing - Strokes and marks, marks already resized to the stroke width.
 * @param scale - Factor applied to distances from `center`, in (0, 1].
 * @param center - Fixed point of the scaling, the frame centre.
 * @returns A new drawing; the input is not modified.
 */
export function scaleDrawing(drawing: Drawing, scale: number, center: Point): Drawing {
  if (scale === 1) return drawing;
  /**
   * Moves one position towards the centre.
   *
   * @param point - Position in frame units.
   * @returns The moved position.
   */
  const move = (point: Point): Point => ({
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale,
  });
  const marks = drawing.marks.map((mark): Mark => {
    switch (mark.kind) {
      case 'start-circle':
      case 'end-bar':
        return { ...mark, center: move(mark.center) };
      case 'loop': {
        const anchor = move(mark.anchor);
        if (mark.lastSegment !== undefined) {
          return fitEndLoop(mark, mark.lastSegment, anchor, scale);
        }
        return {
          ...mark,
          anchor,
          center: {
            x: anchor.x + mark.center.x - mark.anchor.x,
            y: anchor.y + mark.center.y - mark.anchor.y,
          },
        };
      }
    }
  });
  return { strokes: drawing.strokes.map((stroke) => stroke.map(move)), marks };
}

/**
 * Moves the loop of the last cell with the drawing. Its clearance from the end
 * bar keeps its size, like the stroke it is measured in; its radius shrinks
 * only when the shortened last segment can no longer hold the loop and that
 * clearance, so the loop keeps touching the path.
 *
 * @param loop - End loop, already resized to the stroke width.
 * @param segment - Its `lastSegment`, before the move; not null.
 * @param anchor - Moved end point.
 * @param scale - Factor applied to positions, in (0, 1].
 * @returns The moved loop, its `lastSegment` shortened by `scale`.
 */
function fitEndLoop(loop: LoopMark, segment: Point, anchor: Point, scale: number): LoopMark {
  const segmentLength = Math.hypot(segment.x, segment.y);
  const offset = { x: loop.center.x - loop.anchor.x, y: loop.center.y - loop.anchor.y };
  const back = (offset.x * segment.x + offset.y * segment.y) / segmentLength;
  const clearance = back - loop.radius;
  const lastSegment = { x: segment.x * scale, y: segment.y * scale };
  const radius = Math.max(
    Math.min(loop.radius, segmentLength * scale - clearance),
    END_LOOP_MIN_RADIUS,
  );
  const side = loopSide(segment, offset);
  const along = (radius + clearance) / (segmentLength * scale);
  return {
    ...loop,
    anchor,
    lastSegment,
    radius,
    center: {
      x: anchor.x + lastSegment.x * along + side.x * radius,
      y: anchor.y + lastSegment.y * along + side.y * radius,
    },
  };
}

/**
 * Factor that brings the whole drawing inside the framing circle.
 *
 * The outer edge of every line and mark (half a stroke beyond its geometry)
 * must stay within the circle's inner edge minus a gap of
 * max(2 stroke widths, 2 units).
 *
 * @param drawing - Strokes and marks, marks already resized to the stroke width.
 * @param strokeWidth - Stroke width in frame units, positive.
 * @param center - Centre of the framing circle.
 * @returns 1 when the drawing already fits; otherwise the largest factor in
 *   (0, 1) that makes it fit. Marks so large that they cannot fit even at the
 *   centre give a factor near 0.
 */
export function frameFitScale(drawing: Drawing, strokeWidth: number, center: Point): number {
  const gap = Math.max(FRAME_GAP_STROKES * strokeWidth, FRAME_GAP_MIN);
  const limit = FRAME_CIRCLE_RADIUS - strokeWidth / 2 - gap;
  /**
   * Tells whether the drawing shrunk by a factor stays inside the circle.
   *
   * @param scale - Factor in [0, 1].
   * @returns True when its outer edge stays within the limit.
   */
  const fits = (scale: number): boolean =>
    outerReach(scaleDrawing(drawing, scale, center), center) + strokeWidth / 2 <= limit;

  if (fits(1)) return 1;
  // The reach grows with the factor for every drawing a method produces, so bisection applies.
  let low = 0;
  let high = 1;
  for (let round = 0; round < BISECTION_ROUNDS; round += 1) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return low;
}

/**
 * Farthest distance from `center` reached by the geometry of the drawing
 * (centre lines, without the stroke width).
 *
 * @param drawing - Strokes and marks.
 * @param center - Reference point.
 * @returns The largest distance, 0 for an empty drawing.
 */
function outerReach(drawing: Drawing, center: Point): number {
  /**
   * Distance of a position from the centre.
   *
   * @param point - Position in frame units.
   * @returns The distance in frame units.
   */
  const distance = (point: Point): number => Math.hypot(point.x - center.x, point.y - center.y);
  let reach = 0;
  for (const stroke of drawing.strokes) {
    for (const point of stroke) reach = Math.max(reach, distance(point));
  }
  for (const mark of drawing.marks) {
    if (mark.kind === 'end-bar') {
      for (const end of endBarEndpoints(mark, mark.length)) reach = Math.max(reach, distance(end));
    } else {
      reach = Math.max(reach, distance(mark.center) + mark.radius);
    }
  }
  return reach;
}
