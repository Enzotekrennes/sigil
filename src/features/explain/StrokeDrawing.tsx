/**
 * Small static drawing of polylines in the sigil's 0–100 frame, used by the
 * Spare panel for the letter skeletons and for the letters laid on top of
 * each other before the merge.
 *
 * Exposes `StrokeDrawing`. No animation and no marks. The stroke keeps the
 * same on-screen width whatever the drawing size (`non-scaling-stroke`), so a
 * 56 px tile and a 240 px drawing read alike; its colour comes from the
 * tokens through the class given by the parent.
 */
import { formatCoordinate, polylinePathData } from '../sigil/index.ts';
import type { Box, Point } from '../sigil/types.ts';

/**
 * Stroke width in screen pixels (the stroke does not scale with the drawing):
 * the fine line of the design, thin enough for the letters of a 56 px tile to
 * stay apart, thick enough to read as the sigil's own line.
 */
const DRAWING_STROKE_WIDTH = 1.5;

/** Props of `StrokeDrawing`. */
export interface StrokeDrawingProps {
  /** Polylines to draw, in the 0–100 frame. */
  readonly strokes: readonly (readonly Point[])[];
  /** Part of the frame to show. */
  readonly viewBox: Box;
  /** Class of the `<svg>`, which sets its size and stroke colour. */
  readonly className: string;
  /**
   * Accessible name. Without it the drawing is decorative (`aria-hidden`),
   * for a drawing whose meaning is already given by the text next to it.
   */
  readonly label?: string;
}

/**
 * Renders the polylines.
 *
 * @returns An `<svg>`: `role="img"` with `label`, or hidden from assistive
 *   technologies without it.
 */
export function StrokeDrawing({ strokes, viewBox, className, label }: StrokeDrawingProps) {
  const { x, y, width, height } = viewBox;
  const accessibility =
    label === undefined
      ? ({ 'aria-hidden': true, focusable: false } as const)
      : ({ role: 'img', 'aria-label': label } as const);

  return (
    <svg
      className={className}
      viewBox={[x, y, width, height].map(formatCoordinate).join(' ')}
      {...accessibility}
    >
      <g
        fill="none"
        strokeWidth={DRAWING_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {strokes.map((stroke, index) => (
          // Strokes never reorder, so the index is a stable key.
          <path key={index} d={polylinePathData(stroke)} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
}
