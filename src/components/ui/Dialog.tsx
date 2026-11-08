/**
 * Modal dialog built on the native `<dialog>` element opened with
 * `showModal()`: the rest of the page becomes inert, the dialog sits on the
 * top layer above a backdrop, and Escape closes it.
 *
 * Exposes `Dialog`. Controlled: the parent owns `open` and is told when the
 * user asks to close (Escape, handled on the key itself so the state never
 * lags behind the element). Adds what the
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
   * Tells the parent the native element has closed, unless it already knows:
   * not when `open` is already false (the parent asked, or Escape was reported
   * on `cancel`), nor for a stale `close` event arriving after the dialog was
   * opened again (the element is open then).
   */
  function reportClosed() {
    if (open && dialog.current?.open !== true) onClose();
  }

  /**
   * Handles the keys the dialog owns. Escape closes it through the parent at
   * once, on the key itself: the browser's own route (`cancel`, then a queued
   * `close`) can lag behind a key pressed right after, and is skipped for
   * `cancel` when the page has had no user activation since the last one.
   * Tab and Shift+Tab wrap around from the last focusable element to the first.
   *
   * @param event - Key pressed inside the dialog.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      // Stops the native close request: the element closes when `open` turns false.
      event.preventDefault();
      if (open) onClose();
      return;
    }
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
      onCancel={(event) => {
        // A close request not made by Escape inside the dialog (a back gesture):
        // the browser fires `cancel` at once, then closes the element and queues
        // `close`; reporting here keeps `open` in step before the next key press.
        if (open && !event.defaultPrevented) onClose();
      }}
      onClose={() => {
        // Any other native close (the queued `close` of an Escape included).
        reportClosed();
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
