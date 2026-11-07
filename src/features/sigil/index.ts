/**
 * Public API of the sigil feature: the renderer, its style settings and the
 * pure geometry the export feature may reuse.
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
  frameCenter,
  lineEndsFor,
  scaleMark,
  showsFrameCircle,
} from './style.ts';
export type { LineEnds } from './style.ts';
export type { RenderMode, StyleOptions } from './types.ts';
