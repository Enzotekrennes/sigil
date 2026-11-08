/**
 * Small mutually exclusive choice for the header (interface language, theme):
 * native radio buttons in a `<fieldset>`, drawn as a row of square segments
 * that each keep a 44 px touch target.
 *
 * Exposes `CompactChoice` and `CompactOption`. Unlike `SegmentedControl`, the
 * legend is not drawn and each segment shows a short face (a code such as
 * "FR", or an icon) while screen readers hear the option's full label. The
 * label is also the segment's tooltip, so an icon-only face can be named by
 * pointing at it. Native radios give the keyboard behaviour (Tab enters the
 * group on the checked option, arrows move the choice).
 */
import type { ReactNode } from 'react';

import './CompactChoice.css';
import './VisuallyHidden.css';

/** One segment of the choice. */
export interface CompactOption<Value extends string> {
  /** Value reported by `onChange`. */
  readonly value: Value;
  /** What the segment draws: a short code or an icon; hidden from screen readers. */
  readonly face: ReactNode;
  /** Full name of the option, read by screen readers and shown as the tooltip. */
  readonly label: string;
  /** Language of `label` when it differs from the page's (a language's own name). */
  readonly lang?: string;
}

/** Props of `CompactChoice`. */
export interface CompactChoiceProps<Value extends string> {
  /** Accessible name of the group, rendered as a visually hidden `<legend>`. */
  readonly legend: string;
  /** `name` shared by the radios; unique in the page. */
  readonly name: string;
  /** Options in display order; two or three fit in the 375 px header. */
  readonly options: readonly CompactOption<Value>[];
  /** Selected value. */
  readonly value: Value;
  /** Called with the value of the option the user selects. */
  readonly onChange: (value: Value) => void;
}

/**
 * Renders the group: a hidden legend, then one segment per option.
 *
 * @returns The `<fieldset>` element.
 */
export function CompactChoice<Value extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: CompactChoiceProps<Value>) {
  return (
    <fieldset className="compact-choice">
      <legend className="visually-hidden">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="compact-choice__option"
          title={option.label}
          lang={option.lang}
        >
          <input
            type="radio"
            className="compact-choice__input visually-hidden"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => {
              onChange(option.value);
            }}
          />
          <span className="compact-choice__face" aria-hidden="true">
            {option.face}
          </span>
          <span className="visually-hidden">{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
