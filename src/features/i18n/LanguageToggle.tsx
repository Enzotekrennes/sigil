/**
 * The FR | EN selector of the header: two native radio buttons in a
 * `<fieldset>`, drawn as a compact pair of segments.
 *
 * Exposes `LanguageToggle`, its props and `LanguageToggleStrings`. Controlled:
 * the caller owns the language (see `LanguageProvider`). Each option shows
 * its short code and is announced by the language's own name, marked with
 * its `lang` so screen readers pronounce "Français" and "English" correctly
 * whatever the interface language.
 */
import '../../components/ui/VisuallyHidden.css';
import { LANGUAGES } from './language.ts';
import type { Language } from './language.ts';
import './LanguageToggle.css';

/** Texts of the selector, in the interface language. */
export interface LanguageToggleStrings {
  /** Accessible name of the group ("Langue de l’interface"), not drawn. */
  readonly legend: string;
  /** Short code drawn on each option ("FR", "EN"). */
  readonly codes: Readonly<Record<Language, string>>;
  /** Name of each language in that language ("Français", "English"), read by screen readers. */
  readonly names: Readonly<Record<Language, string>>;
}

/** Props of `LanguageToggle`. */
export interface LanguageToggleProps {
  /** Language shown. */
  readonly value: Language;
  /** Called with the language the user selects. */
  readonly onChange: (language: Language) => void;
  /** Interface texts. */
  readonly strings: LanguageToggleStrings;
}

/** `name` shared by the radios; unique in the page. */
const RADIO_NAME = 'interface-language';

/**
 * Renders the selector: a hidden legend, then one segment per language.
 *
 * @returns The `<fieldset>` element.
 */
export function LanguageToggle({ value, onChange, strings }: LanguageToggleProps) {
  return (
    <fieldset className="language-toggle">
      <legend className="visually-hidden">{strings.legend}</legend>
      {LANGUAGES.map((language) => (
        <label key={language} className="language-toggle__option">
          <input
            type="radio"
            className="language-toggle__input visually-hidden"
            name={RADIO_NAME}
            value={language}
            checked={language === value}
            onChange={() => {
              onChange(language);
            }}
          />
          <span className="language-toggle__face" aria-hidden="true">
            {strings.codes[language]}
          </span>
          <span className="visually-hidden" lang={language}>
            {strings.names[language]}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
