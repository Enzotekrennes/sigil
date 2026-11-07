/**
 * Numeric setting chosen along a track, built on a native
 * `<input type="range">`, with a visible label, the current value written
 * next to it and an optional help text under it.
 *
 * Exposes `Slider`. The native input gives the keyboard behaviour (arrows
 * move by one step, Page Up / Page Down by larger jumps, Home / End to the
 * ends). The value shown is formatted by the caller, who may also give a
 * separate text for assistive technologies (`aria-valuetext`), so a decimal
 * is written and read the way the interface language says it.
 */
import './Slider.css';

/** Props of `Slider`. */
export interface SliderProps {
  /** Id of the input; the value and help ids are derived from it. */
  readonly id: string;
  /** Visible label, which is also the accessible name. */
  readonly label: string;
  /** Current value, between `min` and `max`, on a `step`. */
  readonly value: number;
  /** Smallest value. */
  readonly min: number;
  /** Largest value. */
  readonly max: number;
  /** Distance between two values the slider can take. */
  readonly step: number;
  /**
   * Called with the value the user moves to, as the browser reads it (it may
   * carry floating point noise; the caller rounds it to its own grid).
   */
  readonly onValueChange: (value: number) => void;
  /** Value as shown next to the label (for instance "fin · 1,2"). */
  readonly valueText: string;
  /**
   * Value as read by assistive technologies (for instance "1,2, fin");
   * defaults to `valueText`.
   */
  readonly ariaValueText?: string;
  /** Help text under the slider, linked to it by `aria-describedby`. */
  readonly help?: string;
}

/**
 * Renders the slider with its label, value and help.
 *
 * @returns The slider block.
 */
export function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  onValueChange,
  valueText,
  ariaValueText = valueText,
  help,
}: SliderProps) {
  const helpId = `${id}-help`;

  return (
    <div className="slider">
      <div className="slider__header">
        <label className="slider__label" htmlFor={id}>
          {label}
        </label>
        {/* Repeats the value for sighted users; the input reads it through aria-valuetext. */}
        <output className="slider__value" htmlFor={id} aria-hidden="true">
          {valueText}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="slider__input"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={ariaValueText}
        aria-describedby={help === undefined ? undefined : helpId}
        onChange={(event) => {
          onValueChange(Number(event.target.value));
        }}
      />
      {help !== undefined && (
        <p className="slider__help" id={helpId}>
          {help}
        </p>
      )}
    </div>
  );
}
