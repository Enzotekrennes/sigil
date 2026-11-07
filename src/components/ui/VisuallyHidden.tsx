/**
 * Text read by assistive technologies but not drawn on screen.
 *
 * Exposes `VisuallyHidden` and the `visually-hidden` class it relies on
 * (also used directly on native inputs styled through their label).
 */
import type { ReactNode } from 'react';

import './VisuallyHidden.css';

/** Props of `VisuallyHidden`. */
export interface VisuallyHiddenProps {
  /** Content announced by screen readers only. */
  readonly children: ReactNode;
  /** Id, so the text can be referenced by `aria-labelledby` or `aria-describedby`. */
  readonly id?: string;
}

/**
 * Renders a `<span>` clipped out of view but kept in the accessibility tree.
 *
 * @returns The hidden span.
 */
export function VisuallyHidden({ children, id }: VisuallyHiddenProps) {
  return (
    <span className="visually-hidden" id={id}>
      {children}
    </span>
  );
}
