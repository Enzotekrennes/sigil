/**
 * Geometry of the tattoo stencil mode: the stroke width is chosen in real
 * millimetres for a given print size, and the print size is the largest
 * dimension of the ink actually laid on paper (strokes and marks, their
 * stroke width included), which is what a tattoo artist measures with a ruler.
 *
 * Exposes the millimetre setting (`STENCIL_STROKE_MM_*`, `snapStencilStrokeMm`),
 * `inkBounds` (exact outer edge of a drawing) and `stencilScale`, which turns
 * millimetres and a print size into a stroke width in frame units and a
 * millimetres-per-unit factor. Pure functions. Colours (pure black on pure
 * white) are not here: they come from the `--stencil-*` tokens.
 */
import { endBarEndpoints } from './geometry.ts';
import { fittedDrawing } from './frameFit.ts';
import type { Drawing } from './frameFit.ts';
import { MARK_REFERENCE_STROKE_WIDTH } from './frame.ts';
import { lineEndsFor } from './style.ts';
import type { Box, Point, Sigil } from './types.ts';

/** Default stencil stroke, in millimetres on paper: a fine-line needle (docs/design.md). */
export const STENCIL_STROKE_MM_DEFAULT = 0.6;

/** Thinnest stencil stroke offered, in millimetres: below it a transfer loses the line. */
export const STENCIL_STROKE_MM_MIN = 0.3;

/** Thickest stencil stroke offered, in millimetres (docs/design.md). */
export const STENCIL_STROKE_MM_MAX = 1.2;

/** Step of the millimetre setting. */
export const STENCIL_STROKE_MM_STEP = 0.1;

/** Steps of the stroke setting per millimetre, an exact integer (10). */
const STEPS_PER_MM = Math.round(1 / STENCIL_STROKE_MM_STEP);

/**
 * Fixed-point rounds of `stencilScale`. Each round shrinks the error by the
 * share of the stroke in the drawing (below 0.6 even at 1 cm and 1.2 mm), so
 * the loop stops on its tolerance well before this bound.
 */
const SCALE_ROUNDS = 100;

/** Relative change of the stroke width under which `stencilScale` has converged. */
const SCALE_TOLERANCE = 1e-12;

/**
 * Brings any millimetre value onto the setting's grid: clamped to
 * [`STENCIL_STROKE_MM_MIN`, `STENCIL_STROKE_MM_MAX`] and rounded to the
 * nearest `STENCIL_STROKE_MM_STEP`.
 *
 * @param millimetres - Value read from a slider; `NaN` gives the default.
 * @returns A value the setting offers, with at most one decimal.
 */
export function snapStencilStrokeMm(millimetres: number): number {
  if (Number.isNaN(millimetres)) return STENCIL_STROKE_MM_DEFAULT;
  const clamped = Math.min(Math.max(millimetres, STENCIL_STROKE_MM_MIN), STENCIL_STROKE_MM_MAX);
  // Dividing the step count by the steps per millimetre (rather than
  // multiplying by the step) keeps the result free of binary noise (0.7, not
  // 0.7000000000000001).
  return Math.round(clamped / STENCIL_STROKE_MM_STEP) / STEPS_PER_MM;
}

/**
 * Outer edge of the ink of a drawing: its geometry widened by half the stroke
 * width the way SVG and PDF stroke it.
 *
 * Exact for rounded ends and joins (the ink is the geometry swept by a disc)
 * and for the hollow circles of the marks. With flat ends, each segment is a
 * rectangle and each join adds its miter tip when the miter stays within the
 * limit of `lineEndsFor` (beyond it the join is bevelled and adds nothing).
 *
 * @param drawing - Strokes and marks as drawn (see `fittedDrawing`).
 * @param strokeWidth - Stroke width in frame units, positive.
 * @param roundEnds - `StyleOptions.roundEnds`.
 * @returns The bounding box of the ink, in frame units; a zero box at the
 *   origin for an empty drawing.
 */
export function inkBounds(drawing: Drawing, strokeWidth: number, roundEnds: boolean): Box {
  const half = strokeWidth / 2;
  const points: Point[] = [];
  for (const stroke of drawing.strokes) {
    if (roundEnds) points.push(...stroke.flatMap((point) => square(point, half)));
    else points.push(...flatStrokeOutline(stroke, half));
  }
  for (const mark of drawing.marks) {
    if (mark.kind !== 'end-bar') {
      points.push(...square(mark.center, mark.radius + half));
      continue;
    }
    const bar = endBarEndpoints(mark, mark.length);
    if (roundEnds) points.push(...bar.flatMap((point) => square(point, half)));
    else points.push(...flatStrokeOutline(bar, half));
  }
  return boundingBox(points);
}

/** Stroke width and paper scale that put a sigil in stencil mode at a given print size. */
export interface StencilScale {
  /** Stroke width in frame units that prints at the requested millimetres. */
  readonly strokeWidth: number;
  /** Millimetres on paper per frame unit. */
  readonly millimetresPerUnit: number;
  /** Outer edge of the ink at that stroke width, in frame units. */
  readonly ink: Box;
  /** The drawing at that stroke width (marks resized, no framing circle). */
  readonly drawing: Drawing;
}

/**
 * Finds the stroke width at which a sigil, printed so that the largest
 * dimension of its ink is `sizeMm`, has a stroke of `strokeMm`.
 *
 * The two depend on each other (the ink includes the stroke and the marks
 * grow with it), so the scale is found by fixed-point iteration: scale from
 * the ink, stroke from the scale, again until the stroke no longer moves.
 *
 * @param sigil - Sigil to print.
 * @param roundEnds - `StyleOptions.roundEnds`, which changes the ink's edge.
 * @param strokeMm - Stroke on paper in millimetres, positive.
 * @param sizeMm - Largest dimension of the ink on paper in millimetres, positive.
 * @returns The stroke width, the scale, the ink box and the drawing; with
 *   them `ink` × `millimetresPerUnit` measures `sizeMm` on its larger side and
 *   `strokeWidth` × `millimetresPerUnit` equals `strokeMm`.
 * @throws {RangeError} When a size or stroke is not a positive finite number,
 *   or the sigil has no ink.
 */
export function stencilScale(
  sigil: Sigil,
  roundEnds: boolean,
  strokeMm: number,
  sizeMm: number,
): StencilScale {
  if (!(strokeMm > 0 && Number.isFinite(strokeMm) && sizeMm > 0 && Number.isFinite(sizeMm))) {
    throw new RangeError(
      `Stencil stroke and size must be positive millimetres, got ${String(strokeMm)} and ${String(sizeMm)}.`,
    );
  }
  let strokeWidth = MARK_REFERENCE_STROKE_WIDTH;
  let result = measure(sigil, roundEnds, strokeWidth, sizeMm);
  for (let round = 0; round < SCALE_ROUNDS; round += 1) {
    const next = strokeMm / result.millimetresPerUnit;
    const converged = Math.abs(next - strokeWidth) <= SCALE_TOLERANCE * next;
    strokeWidth = next;
    result = measure(sigil, roundEnds, strokeWidth, sizeMm);
    if (converged) break;
  }
  return result;
}

/**
 * Draws the sigil in stencil mode at a stroke width and scales its ink to the size.
 *
 * @param sigil - Sigil to print.
 * @param roundEnds - Line ends setting.
 * @param strokeWidth - Stroke width in frame units, positive.
 * @param sizeMm - Largest ink dimension on paper, in millimetres.
 * @returns The scale reached for that stroke width.
 * @throws {RangeError} When the drawing has no extent.
 */
function measure(
  sigil: Sigil,
  roundEnds: boolean,
  strokeWidth: number,
  sizeMm: number,
): StencilScale {
  const drawing = fittedDrawing(sigil, {
    strokeWidth,
    roundEnds,
    frameCircle: false,
    mode: 'stencil',
  });
  const ink = inkBounds(drawing, strokeWidth, roundEnds);
  const largest = Math.max(ink.width, ink.height);
  if (!(largest > 0)) throw new RangeError('Cannot scale a stencil: the sigil has no ink.');
  return { strokeWidth, millimetresPerUnit: sizeMm / largest, ink, drawing };
}

/**
 * Outline points of a polyline stroked with flat ends and mitred joins.
 *
 * @param line - Points of the polyline, in order.
 * @param half - Half the stroke width.
 * @returns The corners of each segment's rectangle and the miter tips kept
 *   within the limit.
 */
function flatStrokeOutline(line: readonly Point[], half: number): Point[] {
  const miterLimit = lineEndsFor(false).strokeMiterlimit ?? 1;
  const outline: Point[] = [];
  const directions: Point[] = [];
  for (let index = 1; index < line.length; index += 1) {
    const from = line[index - 1];
    const to = line[index];
    if (from === undefined || to === undefined) continue;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length === 0) continue;
    const direction = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
    const normal = { x: -direction.y * half, y: direction.x * half };
    outline.push(
      { x: from.x + normal.x, y: from.y + normal.y },
      { x: from.x - normal.x, y: from.y - normal.y },
      { x: to.x + normal.x, y: to.y + normal.y },
      { x: to.x - normal.x, y: to.y - normal.y },
    );
    const previous = directions.at(-1);
    directions.push(direction);
    if (previous === undefined) continue;
    const tip = miterTip(from, previous, direction, half, miterLimit);
    if (tip !== undefined) outline.push(tip);
  }
  return outline;
}

/**
 * Tip of the miter at a join, when the join is mitred rather than bevelled.
 *
 * @param vertex - Point where the two segments meet.
 * @param incoming - Unit direction of the segment arriving at `vertex`.
 * @param outgoing - Unit direction of the segment leaving `vertex`.
 * @param half - Half the stroke width.
 * @param miterLimit - Largest miter length over stroke width (SVG and PDF meaning).
 * @returns The tip, or `undefined` for a straight join or a bevelled one.
 */
function miterTip(
  vertex: Point,
  incoming: Point,
  outgoing: Point,
  half: number,
  miterLimit: number,
): Point | undefined {
  // sin(θ/2) for the angle θ between the two segments, from their dot product.
  const sinHalfAngle = Math.sqrt(
    Math.max(0, (1 + incoming.x * outgoing.x + incoming.y * outgoing.y) / 2),
  );
  const outward = { x: incoming.x - outgoing.x, y: incoming.y - outgoing.y };
  const outwardLength = Math.hypot(outward.x, outward.y);
  if (outwardLength === 0 || sinHalfAngle === 0 || 1 / sinHalfAngle > miterLimit) return undefined;
  const reach = half / sinHalfAngle / outwardLength;
  return { x: vertex.x + outward.x * reach, y: vertex.y + outward.y * reach };
}

/**
 * Corners of the square of half-side `half` around a point: enough to bound a disc.
 *
 * @param point - Centre.
 * @param half - Half the side.
 * @returns The two opposite corners.
 */
function square(point: Point, half: number): Point[] {
  return [
    { x: point.x - half, y: point.y - half },
    { x: point.x + half, y: point.y + half },
  ];
}

/**
 * Bounding box of points.
 *
 * @param points - Any points.
 * @returns The smallest box holding them, or a zero box at the origin when empty.
 */
function boundingBox(points: readonly Point[]): Box {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
