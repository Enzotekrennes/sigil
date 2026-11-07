/**
 * Style settings of the sigil renderer: default `StyleOptions`, the framing
 * circle geometry, the SVG line cap and join for each setting, and the
 * resizing of marks to the chosen stroke width.
 *
 * Pure values and functions; colours are not here, they come from the CSS
 * tokens (see `SigilRenderer.css`).
 */
import type { Box, Mark, Point, StyleOptions } from './types.ts';

/**
 * Stroke width the methods size their marks for, in frame units: the design
 * default of 12 in a 1000-unit frame. Must match `REFERENCE_STROKE_WIDTH` in
 * `features/kamea/buildKameaSigil.ts`.
 */
export const MARK_REFERENCE_STROKE_WIDTH = 1.2;

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
 * Resizes a mark so it keeps its proportions to the stroke: marks are sized
 * by the methods for `MARK_REFERENCE_STROKE_WIDTH`.
 *
 * Circles and bars stay anchored where the path is: the start circle and the
 * end bar keep their centre, a loop keeps its tangency point and moves its
 * centre along the same normal so it still touches the path.
 *
 * @param mark - Mark as produced by the method.
 * @param strokeWidth - Chosen stroke width in frame units, positive.
 * @returns A new mark with radius or length (and loop centre) scaled by
 *   `strokeWidth / MARK_REFERENCE_STROKE_WIDTH`.
 */
export function scaleMark(mark: Mark, strokeWidth: number): Mark {
  const factor = strokeWidth / MARK_REFERENCE_STROKE_WIDTH;
  switch (mark.kind) {
    case 'start-circle':
      return { ...mark, radius: mark.radius * factor };
    case 'end-bar':
      return { ...mark, length: mark.length * factor };
    case 'loop':
      return {
        ...mark,
        radius: mark.radius * factor,
        center: {
          x: mark.anchor.x + (mark.center.x - mark.anchor.x) * factor,
          y: mark.anchor.y + (mark.center.y - mark.anchor.y) * factor,
        },
      };
  }
}
