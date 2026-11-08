/**
 * The FR | EN selector of the header, drawn with the shared `CompactChoice`
 * of the header selectors.
 *
 * Exposes `LanguageToggle`, its props and `LanguageToggleStrings`. Controlled:
 * the caller owns the language (see `LanguageProvider`). Each option shows
 * its short code and is announced by the language's own name, marked with
 * its `lang` so screen readers pronounce "Français" and "English" correctly
 * whatever the interface language.
 */
import { CompactChoice } from '../../components/ui/index.ts';
import type { CompactOption } from '../../components/ui/index.ts';
import { LANGUAGES } from './language.ts';
import type { Language } from './language.ts';

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
  const options: CompactOption<Language>[] = LANGUAGES.map((language) => ({
    value: language,
    face: strings.codes[language],
    label: strings.names[language],
    lang: language,
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
