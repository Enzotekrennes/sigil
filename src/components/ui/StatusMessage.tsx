/**
 * Short status line (success, warning, error, information) with an icon and
 * text, in a polite live region.
 *
 * Exposes `StatusMessage` and `StatusTone`. The tone is carried by the icon
 * shape and the text, never by colour alone.
 */
import type { ReactNode } from 'react';

import './StatusMessage.css';

/** Kind of status, which picks the colour and the icon. */
export type StatusTone = 'success' | 'warning' | 'error' | 'info';

/** Props of `StatusMessage`. */
export interface StatusMessageProps {
  /** Kind of status. */
  readonly tone: StatusTone;
  /** Message; one or two sentences saying what happened and what to do. */
  readonly children: ReactNode;
}

/** Icon path of each tone, drawn in a 16 × 16 box with a 1.5 stroke. */
const TONE_ICON_PATHS: Readonly<Record<StatusTone, string>> = {
  success: 'M4.5 8.5l2.5 2.5 4.5-5',
  warning: 'M8 5v4M8 11.5v.5',
  error: 'M5.5 5.5l5 5M10.5 5.5l-5 5',
  info: 'M8 7.5v4M8 4.5v.5',
};

/**
 * Renders the message with `role="status"`, so screen readers announce it
 * without interrupting.
 *
 * @returns The status block.
 */
export function StatusMessage({ tone, children }: StatusMessageProps) {
  return (
    <p className={`status-message status-message--${tone}`} role="status">
      <svg
        className="status-message__icon"
        viewBox="0 0 16 16"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path
          d={TONE_ICON_PATHS[tone]}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="status-message__text">{children}</span>
    </p>
  );
}
