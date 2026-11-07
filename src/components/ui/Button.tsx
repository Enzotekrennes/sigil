/**
 * Generic push button of the interface, in the three variants of the design:
 * `primary` (accent background), `secondary` (outline) and `ghost` (text).
 *
 * Exposes `Button`. Carries no business logic and no text of its own: the
 * label is the children. Defaults to `type="button"` so it never submits a
 * form by accident.
 */
import type { ButtonHTMLAttributes } from 'react';

import './Button.css';

/** Visual weight of a button: one `primary` action per area at most. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

/** Props of `Button`: every native button attribute, plus the variant. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight; defaults to `secondary`. */
  readonly variant?: ButtonVariant;
  /** Stretches the button to the width of its container (mobile primary action). */
  readonly fullWidth?: boolean;
}

/**
 * Renders a native `<button>` with the design's states: rest, hover, visible
 * focus ring, pressed and disabled.
 *
 * @returns The button element.
 */
export function Button({
  variant = 'secondary',
  fullWidth = false,
  type = 'button',
  className,
  ...native
}: ButtonProps) {
  const classNames = ['button', `button--${variant}`];
  if (fullWidth) classNames.push('button--full-width');
  if (className !== undefined) classNames.push(className);

  return <button {...native} type={type} className={classNames.join(' ')} />;
}
