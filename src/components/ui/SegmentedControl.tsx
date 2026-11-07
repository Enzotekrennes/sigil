/**
 * Mutually exclusive choice drawn as a row of joined segments, built on
 * native radio buttons inside a `<fieldset>`.
 *
 * Exposes `SegmentedControl` and `SegmentedOption`. Native radios give the
 * keyboard behaviour for free (Tab enters the group, arrows move the choice,
 * disabled options are skipped). An option can be disabled with a short note
 * shown next to its label (for instance "soon").
 */
import './SegmentedControl.css';
import './VisuallyHidden.css';

/** One segment of the control. */
export interface SegmentedOption<Value extends string> {
  /** Value reported by `onChange`. */
  readonly value: Value;
  /** Visible label. */
  readonly label: string;
  /** Greys the option out and makes it unselectable. */
  readonly disabled?: boolean;
  /** Short text after the label, read with it (why the option is unavailable). */
  readonly note?: string;
}

/** Props of `SegmentedControl`. */
export interface SegmentedControlProps<Value extends string> {
  /** Visible title of the group, rendered as the `<legend>`. */
  readonly legend: string;
  /** `name` shared by the radios; unique in the page. */
  readonly name: string;
  /** Options in display order; two to four fit on a 343 px wide screen. */
  readonly options: readonly SegmentedOption<Value>[];
  /** Selected value. */
  readonly value: Value;
  /** Called with the value of the option the user selects. */
  readonly onChange: (value: Value) => void;
}

/**
 * Renders the group: legend, then one segment per option.
 *
 * @returns The `<fieldset>` element.
 */
export function SegmentedControl<Value extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: SegmentedControlProps<Value>) {
  return (
    <fieldset className="segmented">
      <legend className="segmented__legend">{legend}</legend>
      <div className="segmented__track">
        {options.map((option) => (
          <label
            key={option.value}
            className={
              option.disabled === true
                ? 'segmented__option segmented__option--disabled'
                : 'segmented__option'
            }
          >
            <input
              type="radio"
              className="segmented__input visually-hidden"
              name={name}
              value={option.value}
              checked={option.value === value}
              disabled={option.disabled}
              onChange={() => {
                onChange(option.value);
              }}
            />
            <span className="segmented__face">
              {option.label}{' '}
              {option.note !== undefined && <span className="segmented__note">{option.note}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
