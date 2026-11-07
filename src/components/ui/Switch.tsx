/**
 * On/off setting drawn as a small sliding switch, built on a native checkbox
 * with `role="switch"`, with a visible label, the state written next to it
 * and an optional help text under it.
 *
 * Exposes `Switch`. The native checkbox gives the keyboard behaviour (Tab to
 * reach it, Space to toggle). The state is carried by the thumb position and
 * the state text, never by colour alone; the state text is hidden from
 * assistive technologies, which read the switch's own checked state.
 */
import type { Ref } from 'react';

import './Switch.css';
import './VisuallyHidden.css';

/** Props of `Switch`. */
export interface SwitchProps {
  /** Id of the checkbox; the help id is derived from it. */
  readonly id: string;
  /** Visible label, which is also the accessible name. */
  readonly label: string;
  /** Whether the setting is on. */
  readonly checked: boolean;
  /** Called with the new state when the user toggles the switch. */
  readonly onCheckedChange: (checked: boolean) => void;
  /** Short state text shown next to the switch when it is on (for instance "oui"). */
  readonly onText: string;
  /** Short state text shown next to the switch when it is off (for instance "non"). */
  readonly offText: string;
  /** Help text under the switch, linked to it by `aria-describedby`. */
  readonly help?: string;
  /** Ref to the native checkbox, so the parent can move focus to it. */
  readonly inputRef?: Ref<HTMLInputElement>;
}

/**
 * Renders the switch with its label, state text and help.
 *
 * @returns The switch block.
 */
export function Switch({
  id,
  label,
  checked,
  onCheckedChange,
  onText,
  offText,
  help,
  inputRef,
}: SwitchProps) {
  const helpId = `${id}-help`;

  return (
    <div className="switch">
      <label className="switch__control">
        <input
          ref={inputRef}
          id={id}
          type="checkbox"
          role="switch"
          className="switch__input visually-hidden"
          checked={checked}
          aria-describedby={help === undefined ? undefined : helpId}
          onChange={(event) => {
            onCheckedChange(event.target.checked);
          }}
        />
        <span className="switch__label">{label}</span>
        <span className="switch__track" aria-hidden="true">
          <span className="switch__thumb" />
        </span>
        <span className="switch__state" aria-hidden="true">
          {checked ? onText : offText}
        </span>
      </label>
      {help !== undefined && (
        <p className="switch__help" id={helpId}>
          {help}
        </p>
      )}
    </div>
  );
}
