/**
 * Generic push button of the interface, in the three variants of the design:
 * `primary` (accent background), `secondary` (outline) and `ghost` (text),
 * with a loading state for actions that take a moment (an export).
 *
 * Exposes `Button`. Carries no business logic and no text of its own: the
 * label is the children. Defaults to `type="button"` so it never submits a
 * form by accident.
 */
import type { ButtonHTMLAttributes, MouseEvent } from 'react';

import './Button.css';

/** Visual weight of a button: one `primary` action per area at most. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

/** Props of `Button`: every native button attribute, plus the variant. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight; defaults to `secondary`. */
  readonly variant?: ButtonVariant;
  /** Stretches the button to the width of its container (mobile primary action). */
  readonly fullWidth?: boolean;
  /**
   * Action in progress: the label stays, an indicator turns at its right,
   * `aria-busy` is set and clicks are ignored. The button keeps the focus
   * (it is marked `aria-disabled`, not `disabled`, which would drop it).
   */
  readonly loading?: boolean;
}

/**
 * Renders a native `<button>` with the design's states: rest, hover, visible
 * focus ring, pressed, disabled and loading.
 *
 * @returns The button element.
 */
export function Button({
  variant = 'secondary',
  fullWidth = false,
  loading = false,
  type = 'button',
  className,
  children,
  onClick,
  ...native
}: ButtonProps) {
  const classNames = ['button', `button--${variant}`];
  if (fullWidth) classNames.push('button--full-width');
  if (loading) classNames.push('button--loading');
  if (className !== undefined) classNames.push(className);

  /**
   * Forwards a click, unless an action is already in progress.
   *
   * @param event - Click on the button.
   */
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...native}
      type={type}
      className={classNames.join(' ')}
      aria-busy={loading || undefined}
      aria-disabled={loading || native['aria-disabled']}
      onClick={handleClick}
    >
      {children}
      {loading && <span className="button__spinner" aria-hidden="true" />}
    </button>
  );
}
