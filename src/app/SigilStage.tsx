/**
 * The square scene in the middle of the screen: the traced sigil, or an
 * empty circle with an invitation (before the first trace) or a pointer to
 * the error message (after a failed trace).
 *
 * Exposes `SigilStage`. Wraps `SigilRenderer` without adding any behaviour
 * to it; the accessible name of the sigil is given by the parent and never
 * contains the intention.
 */
import {
  DEFAULT_STYLE_OPTIONS,
  FRAME_CIRCLE_RADIUS,
  SigilRenderer,
} from '../features/sigil/index.ts';
import type { Sigil } from '../features/sigil/types.ts';
import './SigilStage.css';

/** Frame of the empty-state drawing, the same 0–100 square as a sigil. */
const EMPTY_FRAME = 100;

/** Hairline width of the empty circle in frame units: present, but never mistaken for a sigil. */
const EMPTY_CIRCLE_WIDTH = 0.3;

/** Props of `SigilStage`. */
export interface SigilStageProps {
  /** Sigil to show; `undefined` shows the empty state. */
  readonly sigil: Sigil | undefined;
  /** Accessible name of the sigil, without the intention. */
  readonly label: string;
  /** Text of the empty state (invitation or pointer to the error). */
  readonly emptyText: string;
  /** Changing it replays the tracing of the same sigil. */
  readonly replayToken: number;
}

/**
 * Renders the scene.
 *
 * @returns The square scene.
 */
export function SigilStage({ sigil, label, emptyText, replayToken }: SigilStageProps) {
  return (
    <div className="sigil-stage">
      {sigil === undefined ? (
        <div className="sigil-stage__empty">
          <svg
            className="sigil-stage__empty-circle"
            viewBox={`0 0 ${String(EMPTY_FRAME)} ${String(EMPTY_FRAME)}`}
            aria-hidden="true"
            focusable="false"
          >
            <circle
              cx={EMPTY_FRAME / 2}
              cy={EMPTY_FRAME / 2}
              r={FRAME_CIRCLE_RADIUS}
              strokeWidth={EMPTY_CIRCLE_WIDTH}
            />
          </svg>
          <p className="sigil-stage__empty-text">{emptyText}</p>
        </div>
      ) : (
        <SigilRenderer
          sigil={sigil}
          styleOptions={DEFAULT_STYLE_OPTIONS}
          label={label}
          replayToken={replayToken}
        />
      )}
    </div>
  );
}
