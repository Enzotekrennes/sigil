/**
 * Draws a `Sigil` as an SVG and animates its tracing.
 *
 * Exposes `SigilRenderer`: one `<path>` per polyline, the marks (start
 * circle, end bar, loops) resized to the chosen stroke width, and the optional
 * framing circle. Colours come from the CSS tokens through
 * `SigilRenderer.css`. The tracing order is: start mark, strokes in path
 * order at constant speed, the other marks, then the framing circle.
 *
 * Does not know the intention and never writes it: the accessible name is
 * supplied by the parent. Does not export files (see the export feature) and
 * has no settings controls.
 */
import type { CSSProperties } from 'react';

import './SigilRenderer.css';
import { endBarEndpoints, formatCoordinate, polylinePathData, traceSchedule } from './geometry.ts';
import {
  frameCenter,
  FRAME_CIRCLE_RADIUS,
  lineEndsFor,
  scaleMark,
  showsFrameCircle,
} from './style.ts';
import type { Mark, Sigil, StyleOptions } from './types.ts';
import { useTraceAnimation } from './useTraceAnimation.ts';

/** Inline style carrying the custom properties read by `SigilRenderer.css`. */
type TraceStyle = CSSProperties & Record<`--${string}`, string>;

/** Props of `SigilRenderer`. */
export interface SigilRendererProps {
  /** Sigil to draw; a different object restarts the tracing animation. */
  readonly sigil: Sigil;
  /** Visual settings; changing them updates the drawing without replaying it. */
  readonly styleOptions: StyleOptions;
  /**
   * Accessible name of the image, written by the parent in the interface
   * language. Must not contain the intention, which would then end up in the
   * SVG markup and its exports.
   */
  readonly label: string;
  /**
   * Replay request: changing this value plays the tracing again for the same
   * sigil. Defaults to 0.
   */
  readonly replayToken?: number;
}

/**
 * Renders the sigil with its style settings and its tracing animation.
 *
 * Under `prefers-reduced-motion: reduce`, the final sigil is shown at once
 * (a short fade, no tracing).
 *
 * @returns An `<svg role="img">` in the sigil's own `viewBox`.
 */
export function SigilRenderer({ sigil, styleOptions, label, replayToken = 0 }: SigilRendererProps) {
  const { animate, runKey } = useTraceAnimation(sigil, replayToken);
  const schedule = traceSchedule(sigil.strokes);
  const lineEnds = lineEndsFor(styleOptions.roundEnds);
  const strokeWidth = formatCoordinate(styleOptions.strokeWidth);
  const marks = sigil.marks.map((mark) => scaleMark(mark, styleOptions.strokeWidth));
  const center = frameCenter(sigil.viewBox);
  const { x, y, width, height } = sigil.viewBox;

  const classNames = [
    'sigil-renderer',
    `sigil-renderer--${styleOptions.mode}`,
    animate ? 'sigil-renderer--trace' : 'sigil-renderer--static',
    sigil.strokes.length > 1 ? 'sigil-renderer--multi-stroke' : 'sigil-renderer--single-stroke',
  ];
  const rootStyle: TraceStyle = {
    '--trace-pen-lifts-total': String(Math.max(sigil.strokes.length - 1, 0)),
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${String(x)} ${String(y)} ${String(width)} ${String(height)}`}
      role="img"
      aria-label={label}
      className={classNames.join(' ')}
      style={rootStyle}
    >
      <g
        key={runKey}
        className="sigil-renderer__ink"
        data-run={runKey}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap={lineEnds.strokeLinecap}
        strokeLinejoin={lineEnds.strokeLinejoin}
        strokeMiterlimit={lineEnds.strokeMiterlimit}
      >
        {marks
          .filter((mark) => mark.kind === 'start-circle')
          .map((mark, index) => renderMark(mark, `start-${String(index)}`, 'before'))}
        {sigil.strokes.map((stroke, index) => {
          const timing = schedule[index];
          const strokeStyle: TraceStyle = {
            '--trace-share': String(timing?.share ?? 0),
            '--trace-offset': String(timing?.offset ?? 0),
            '--trace-pen-lifts': String(timing?.penLiftsBefore ?? 0),
          };
          return (
            <path
              // Strokes never reorder within a run, so the index is a stable key.
              key={index}
              className="sigil-renderer__stroke"
              d={polylinePathData(stroke)}
              pathLength={animate ? 1 : undefined}
              style={animate ? strokeStyle : undefined}
            />
          );
        })}
        {marks
          .filter((mark) => mark.kind !== 'start-circle')
          .map((mark, index) => renderMark(mark, `after-${String(index)}`, 'after'))}
        {showsFrameCircle(styleOptions) && (
          <circle
            className="sigil-renderer__frame"
            cx={formatCoordinate(center.x)}
            cy={formatCoordinate(center.y)}
            r={formatCoordinate(FRAME_CIRCLE_RADIUS)}
            pathLength={animate ? 1 : undefined}
          />
        )}
      </g>
    </svg>
  );
}

/**
 * Draws one mark, already resized to the stroke width.
 *
 * @param mark - Mark to draw.
 * @param key - React key, unique among the marks.
 * @param phase - `before` for marks shown before the strokes are traced
 *   (start circle), `after` for those shown once the tracing ends.
 * @returns A `<circle>` for the start circle and loops, a `<line>` for the end bar.
 */
function renderMark(mark: Mark, key: string, phase: 'before' | 'after') {
  const className = `sigil-renderer__mark sigil-renderer__mark--${phase}`;
  if (mark.kind === 'end-bar') {
    const [from, to] = endBarEndpoints(mark, mark.length);
    return (
      <line
        key={key}
        className={className}
        data-mark={mark.kind}
        x1={formatCoordinate(from.x)}
        y1={formatCoordinate(from.y)}
        x2={formatCoordinate(to.x)}
        y2={formatCoordinate(to.y)}
      />
    );
  }
  return (
    <circle
      key={key}
      className={className}
      data-mark={mark.kind}
      cx={formatCoordinate(mark.center.x)}
      cy={formatCoordinate(mark.center.y)}
      r={formatCoordinate(mark.radius)}
    />
  );
}
