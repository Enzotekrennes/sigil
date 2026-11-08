/**
 * Small static drawing of polylines in the sigil's 0–100 frame, used by the
 * Spare panel: a letter's angular skeleton over its original Hershey letter,
 * and the stem of the bind rune over the letters hooked onto it.
 *
 * Exposes `StrokeDrawing`. Draws two layers: optional context strokes, fine
 * and faint, and the strokes the drawing is about, bolder, on top. No
 * animation and no marks. Strokes keep the same on-screen width whatever the
 * drawing size (`non-scaling-stroke`), so a 64 px tile and a 160 px drawing
 * read alike; colours come from the tokens through the classes given by the
 * parent (`className` on the `<svg>` for the main strokes,
 * `stroke-drawing__context` for the context layer, in SpareExplanation.css).
 */
import { formatCoordinate, polylinePathData } from '../sigil/index.ts';
import type { Box, Point } from '../sigil/types.ts';

/**
 * Width of the main strokes in screen pixels (the stroke does not scale with
 * the drawing): bold enough to stand out from the context layer, thin enough
 * for the letters of a 64 px tile to stay apart.
 */
const MAIN_STROKE_WIDTH = 2;

/**
 * Width of the context strokes in screen pixels: thinner than the main ones,
 * so the difference reads without relying on colour alone.
 */
const CONTEXT_STROKE_WIDTH = 1;

/** Props of `StrokeDrawing`. */
export interface StrokeDrawingProps {
  /** Polylines the drawing is about, in the 0–100 frame, drawn bold on top. */
  readonly strokes: readonly (readonly Point[])[];
  /**
   * Polylines giving context, in the 0–100 frame, drawn fine and faint under
   * `strokes`. Absent or empty: nothing is drawn under.
   */
  readonly context?: readonly (readonly Point[])[];
  /** Part of the frame to show. */
  readonly viewBox: Box;
  /** Class of the `<svg>`, which sets its size and the colour of the main strokes. */
  readonly className: string;
  /**
   * Accessible name. Without it the drawing is decorative (`aria-hidden`),
   * for a drawing whose meaning is already given by the text next to it.
   */
  readonly label?: string;
}

/**
 * Renders the context layer, then the main strokes.
 *
 * @returns An `<svg>`: `role="img"` with `label`, or hidden from assistive
 *   technologies without it.
 */
export function StrokeDrawing({
  strokes,
  context = [],
  viewBox,
  className,
  label,
}: StrokeDrawingProps) {
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
      {context.length > 0 && (
        <StrokeLayer
          strokes={context}
          width={CONTEXT_STROKE_WIDTH}
          className="stroke-drawing__context"
        />
      )}
      <StrokeLayer strokes={strokes} width={MAIN_STROKE_WIDTH} />
    </svg>
  );
}

/** Props of `StrokeLayer`. */
interface StrokeLayerProps {
  /** Polylines of the layer, in the 0–100 frame. */
  readonly strokes: readonly (readonly Point[])[];
  /** Stroke width in screen pixels. */
  readonly width: number;
  /** Class of the group, which may set the layer's colour; absent: the `<svg>` colour. */
  readonly className?: string;
}

/**
 * One group of unfilled, round-ended polylines.
 *
 * @returns A `<g>` with one `<path>` per polyline.
 */
function StrokeLayer({ strokes, width, className }: StrokeLayerProps) {
  return (
    <g
      className={className}
      fill="none"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {strokes.map((stroke, index) => (
        // Strokes never reorder, so the index is a stable key.
        <path key={index} d={polylinePathData(stroke)} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
}
