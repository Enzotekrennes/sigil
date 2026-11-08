/**
 * Public API of the sigil feature: the renderer, its style settings, its
 * replay (animated or step by step), the stencil-mode scale and the pure
 * geometry the export feature may reuse.
 *
 * Model types (`Sigil`, `Mark`, `StyleOptions`…) stay importable from
 * `types.ts`, and the frame constants from `frame.ts`, where the methods take
 * them without loading the renderer.
 */
export { SigilRenderer } from './SigilRenderer.tsx';
export type { SigilRendererProps } from './SigilRenderer.tsx';
export {
  endBarEndpoints,
  formatCoordinate,
  polylineLength,
  polylinePathData,
  traceSchedule,
} from './geometry.ts';
export type { StrokeTiming } from './geometry.ts';
export {
  DEFAULT_STYLE_OPTIONS,
  FRAME_CIRCLE_RADIUS,
  MARK_REFERENCE_STROKE_WIDTH,
  STROKE_WIDTH_MAX,
  STROKE_WIDTH_MIN,
  STROKE_WIDTH_STEP,
  frameCenter,
  lineEndsFor,
  scaleMark,
  showsFrameCircle,
  snapStrokeWidth,
  strokeWidthLevel,
} from './style.ts';
export type { LineEnds, StrokeWidthLevel } from './style.ts';
export { fittedDrawing, frameFitScale, scaleDrawing } from './frameFit.ts';
export {
  inkBounds,
  snapStencilStrokeMm,
  stencilScale,
  STENCIL_STROKE_MM_DEFAULT,
  STENCIL_STROKE_MM_MAX,
  STENCIL_STROKE_MM_MIN,
  STENCIL_STROKE_MM_STEP,
} from './stencil.ts';
export type { StencilScale } from './stencil.ts';
export type { Drawing } from './frameFit.ts';
export { revealSteps, stepwiseStepCount } from './stepwise.ts';
export type { RevealedSigil } from './stepwise.ts';
export { useTraceReplay } from './useTraceReplay.ts';
export type { TraceReplay } from './useTraceReplay.ts';
export type { RenderMode, StyleOptions } from './types.ts';
