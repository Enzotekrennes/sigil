/**
 * Single-line text field with a visible label, a help text, an optional live
 * counter and an error message, all placed under the field.
 *
 * Exposes `TextField`. The error line is always in the DOM as a polite live
 * region, so a new message is announced as soon as it appears. Does not
 * validate anything itself: the parent passes the error to show.
 */
import type { InputHTMLAttributes, Ref } from 'react';

import './TextField.css';

/** Props of `TextField`. Native input attributes other than those below pass through. */
export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'value' | 'onChange' | 'type'
> {
  /** Id of the input; the help, counter and error ids are derived from it. */
  readonly id: string;
  /** Visible label, always shown above the field. */
  readonly label: string;
  /** Current text. */
  readonly value: string;
  /** Called with the new text on every change. */
  readonly onValueChange: (value: string) => void;
  /** Help text under the field, linked to it by `aria-describedby`. */
  readonly help?: string;
  /** Short live information under the help (for instance a letter count). */
  readonly counter?: string;
  /** Error message; when set, the field is marked invalid and the message is announced. */
  readonly error?: string | undefined;
  /** Ref to the native input, so the parent can move focus back to it. */
  readonly inputRef?: Ref<HTMLInputElement>;
}

/**
 * Renders the label, the input and the lines under it.
 *
 * @returns The field block.
 */
export function TextField({
  id,
  label,
  value,
  onValueChange,
  help,
  counter,
  error,
  inputRef,
  className,
  ...native
}: TextFieldProps) {
  const helpId = `${id}-help`;
  const counterId = `${id}-counter`;
  const errorId = `${id}-error`;
  const describedBy = [
    help === undefined ? '' : helpId,
    counter === undefined ? '' : counterId,
    errorId,
  ]
    .filter((part) => part !== '')
    .join(' ');
  const invalid = error !== undefined && error !== '';

  const inputClassNames = ['text-field__input'];
  if (invalid) inputClassNames.push('text-field__input--invalid');
  if (className !== undefined) inputClassNames.push(className);

  return (
    <div className="text-field">
      <label className="text-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        {...native}
        ref={inputRef}
        id={id}
        type="text"
        className={inputClassNames.join(' ')}
        value={value}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => {
          onValueChange(event.target.value);
        }}
      />
      {help !== undefined && (
        <p className="text-field__help" id={helpId}>
          {help}
        </p>
      )}
      {counter !== undefined && (
        <p className="text-field__counter" id={counterId}>
          {counter}
        </p>
      )}
      <p className="text-field__error" id={errorId} aria-live="polite">
        {invalid && (
          <>
            <ErrorIcon />
            <span>{error}</span>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Small "!" in a circle placed before the error text, so the error does not
 * rely on colour alone. Decorative: the text carries the meaning.
 *
 * @returns An `aria-hidden` SVG icon.
 */
function ErrorIcon() {
  return (
    <svg
      className="text-field__error-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4v5M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
