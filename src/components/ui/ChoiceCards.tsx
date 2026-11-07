/**
 * Mutually exclusive choice drawn as a grid of small cards, each with a label
 * and a detail line, built on native radio buttons inside a `<fieldset>`.
 *
 * Exposes `ChoiceCards` and `ChoiceCard`. Used where options need more than
 * a word (a planet and the size of its square). Selected card: accent border
 * and a check mark, so the state does not rely on colour alone.
 */
import './ChoiceCards.css';
import './VisuallyHidden.css';

/** One card of the group. */
export interface ChoiceCard<Value extends string> {
  /** Value reported by `onChange`. */
  readonly value: Value;
  /** Main label, in the serif. */
  readonly label: string;
  /** Secondary line in the monospace (a size, a count). Read after the label. */
  readonly detail?: string;
  /** Greys the card out and makes it unselectable. */
  readonly disabled?: boolean;
}

/** Props of `ChoiceCards`. */
export interface ChoiceCardsProps<Value extends string> {
  /** Visible title of the group, rendered as the `<legend>`. */
  readonly legend: string;
  /** `name` shared by the radios; unique in the page. */
  readonly name: string;
  /** Cards in display order. */
  readonly options: readonly ChoiceCard<Value>[];
  /** Selected value. */
  readonly value: Value;
  /** Called with the value of the card the user selects. */
  readonly onChange: (value: Value) => void;
}

/**
 * Renders the group: legend, then a grid of cards.
 *
 * @returns The `<fieldset>` element.
 */
export function ChoiceCards<Value extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: ChoiceCardsProps<Value>) {
  return (
    <fieldset className="choice-cards">
      <legend className="choice-cards__legend">{legend}</legend>
      <div className="choice-cards__grid">
        {options.map((option) => (
          <label key={option.value} className="choice-cards__option">
            <input
              type="radio"
              className="choice-cards__input visually-hidden"
              name={name}
              value={option.value}
              checked={option.value === value}
              disabled={option.disabled}
              onChange={() => {
                onChange(option.value);
              }}
            />
            <span className="choice-cards__face">
              <span className="choice-cards__label">{option.label}</span>{' '}
              {option.detail !== undefined && (
                <span className="choice-cards__detail">{option.detail}</span>
              )}
              <svg
                className="choice-cards__check"
                viewBox="0 0 16 16"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M3 8.5l3 3 7-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
