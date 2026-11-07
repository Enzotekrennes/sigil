/**
 * Number and plural formatting that follows the interface language: decimal
 * comma in French, decimal point in English, and each language's plural rule
 * (French uses the singular for 0, English the plural).
 *
 * Exposes `formatDecimal` and `countNoun`. Pure; relies on the `Intl` API of
 * the browser, without any library.
 */
import type { Language } from './language.ts';

/** Locale used by `Intl` for each interface language. */
const INTL_LOCALES: Readonly<Record<Language, string>> = {
  fr: 'fr-FR',
  en: 'en-GB',
};

/** Singular and plural forms of a noun, as `Intl.PluralRules` names them. */
export interface NounForms {
  /** Form for the "one" category: 0 and 1 in French, 1 in English. */
  readonly one: string;
  /** Form for every other count. */
  readonly other: string;
}

/**
 * Writes a number with a fixed count of decimals, the way the language does.
 *
 * @param value - The number to write.
 * @param language - Interface language.
 * @param fractionDigits - Decimals to show, an integer from 0 to 20.
 * @returns For instance `"1,2"` in French and `"1.2"` in English.
 */
export function formatDecimal(value: number, language: Language, fractionDigits: number): string {
  return value.toLocaleString(INTL_LOCALES[language], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Writes a count followed by the noun in the form the language requires.
 *
 * @param count - How many; an integer ≥ 0.
 * @param forms - Singular and plural of the noun.
 * @param language - Interface language.
 * @returns For instance `"0 lettre"` in French and `"0 letters"` in English.
 */
export function countNoun(count: number, forms: NounForms, language: Language): string {
  const category = new Intl.PluralRules(INTL_LOCALES[language]).select(count);
  return `${String(count)} ${category === 'one' ? forms.one : forms.other}`;
}
