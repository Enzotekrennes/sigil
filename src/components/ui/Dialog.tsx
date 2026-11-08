/**
 * Modal dialog built on the native `<dialog>` element opened with
 * `showModal()`: the rest of the page becomes inert, the dialog sits on the
 * top layer above a backdrop, and Escape closes it.
 *
 * Exposes `Dialog`. Controlled: the parent owns `open` and is told when the
 * user asks to close (Escape, or a close action of the content). Adds what the
 * native element leaves to the page: Tab and Shift+Tab wrap around inside the
 * dialog (focus never escapes to the page or the browser bar), and the focus
 * goes back to the element that had it before opening. Full screen under
 * 640 px (docs/design.md, Export). Carries no text of its own.
 */
import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import './Dialog.css';

/** Elements that can take the keyboard focus inside the dialog. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Props of `Dialog`. */
export interface DialogProps {
  /** Whether the dialog is shown. */
  readonly open: boolean;
  /** Called when the user asks to close it (Escape); the parent sets `open` to false. */
  readonly onClose: () => void;
  /** Visible title, which is also the dialog's accessible name. */
  readonly title: string;
  /** Content: fields, then the actions. */
  readonly children: ReactNode;
}

/**
 * Renders the dialog and keeps the native element in step with `open`.
 *
 * @returns The `<dialog>` element, empty while closed.
 */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (element === null || !open) return undefined;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
      // The opener may have been removed meanwhile; then the focus stays where the browser puts it.
      if (opener?.isConnected === true) opener.focus();
    };
  }, [open]);

  /**
   * Keeps Tab inside the dialog: from the last focusable element to the
   * first, and back with Shift+Tab.
   *
   * @param event - Key pressed inside the dialog.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab' || dialog.current === null) return;
    const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onClose={() => {
        // Escape closes the native element; tell the parent so `open` follows.
        // A close made by this component after `open` turned false is not reported.
        if (open) onClose();
      }}
    >
      {open && (
        <div className="dialog__body">
          <h2 id={titleId} className="dialog__title">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
