/**
 * The theme selector of the header: system setting, "ink on paper" or "gold
 * on black", drawn with the shared `CompactChoice` of the header selectors.
 *
 * Exposes `ThemeToggle`, its props and `ThemeToggleStrings`. Controlled: the
 * caller owns the theme (see `useTheme` in `theme.ts`). Each segment draws an
 * icon (half-filled disc, sun, crescent) and is announced, and shown as a
 * tooltip, by the theme's name; the group is named "Theme", so the state reads
 * as "Theme: gold on black".
 */
import { CompactChoice } from '../components/ui/index.ts';
import type { CompactOption } from '../components/ui/index.ts';
import { THEME_CHOICES } from './theme.ts';
import type { ThemeChoice } from './theme.ts';

/** Texts of the selector, in the interface language. */
export interface ThemeToggleStrings {
  /** Accessible name of the group ("Thème"), not drawn. */
  readonly legend: string;
  /** Name of each choice ("Système", "Encre sur papier", "Or sur noir"). */
  readonly names: Readonly<Record<ThemeChoice, string>>;
}

/** Props of `ThemeToggle`. */
export interface ThemeToggleProps {
  /** Theme choice shown as selected. */
  readonly value: ThemeChoice;
  /** Called with the choice the user selects. */
  readonly onChange: (choice: ThemeChoice) => void;
  /** Interface texts. */
  readonly strings: ThemeToggleStrings;
}

/** `name` shared by the radios; unique in the page. */
const RADIO_NAME = 'theme';

/**
 * Renders the selector: a hidden legend, then one icon segment per choice.
 *
 * @returns The `<fieldset>` element.
 */
export function ThemeToggle({ value, onChange, strings }: ThemeToggleProps) {
  const options: CompactOption<ThemeChoice>[] = THEME_CHOICES.map((choice) => ({
    value: choice,
    face: <ThemeIcon choice={choice} />,
    label: strings.names[choice],
  }));
  return (
    <CompactChoice
      legend={strings.legend}
      name={RADIO_NAME}
      options={options}
      value={value}
      onChange={onChange}
    />
  );
}

/** Props of `ThemeIcon`. */
interface ThemeIconProps {
  /** Choice the icon stands for. */
  readonly choice: ThemeChoice;
}

/**
 * Icon of a theme choice, drawn in the current text colour on a 16 × 16 grid:
 * a half-filled disc for the system setting, a sun for ink on paper, a
 * crescent for gold on black. Decorative: the option's label carries the meaning.
 *
 * @returns An `aria-hidden` SVG icon.
 */
function ThemeIcon({ choice }: ThemeIconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {choice === 'system' && (
          <>
            <circle cx="8" cy="8" r="5.5" />
            <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
          </>
        )}
        {choice === 'light' && (
          <>
            <circle cx="8" cy="8" r="2.75" />
            <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06" />
          </>
        )}
        {choice === 'dark' && <path d="M13.5 9.6A5.75 5.75 0 1 1 6.4 2.5a4.5 4.5 0 0 0 7.1 7.1z" />}
      </g>
    </svg>
  );
}
