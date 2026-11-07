/**
 * Collapsible section built on the native `<details>` / `<summary>` pair,
 * with a level-two heading in the summary and a chevron showing the state.
 *
 * Exposes `Disclosure`. Controlled: the parent owns `open` and is told about
 * every toggle, including the ones made by the keyboard (Enter, Space).
 */
import type { ReactNode } from 'react';

import './Disclosure.css';

/** Props of `Disclosure`. */
export interface DisclosureProps {
  /** Heading shown in the summary, always visible. */
  readonly title: string;
  /** Whether the content is shown. */
  readonly open: boolean;
  /** Called with the new state when the user opens or closes the section. */
  readonly onOpenChange: (open: boolean) => void;
  /** Content shown when open. */
  readonly children: ReactNode;
}

/**
 * Renders the section.
 *
 * @returns The `<details>` element.
 */
export function Disclosure({ title, open, onOpenChange, children }: DisclosureProps) {
  return (
    <details
      className="disclosure"
      open={open}
      onToggle={(event) => {
        // `toggle` also fires when React sets `open`; only report real changes.
        if (event.currentTarget.open !== open) onOpenChange(event.currentTarget.open);
      }}
    >
      <summary className="disclosure__summary">
        <h2 className="disclosure__title">{title}</h2>
        <span className="disclosure__chevron" aria-hidden="true" />
      </summary>
      <div className="disclosure__content">{children}</div>
    </details>
  );
}
