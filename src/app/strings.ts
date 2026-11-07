/**
 * The interface dictionaries indexed by language, and the hook that returns
 * the one of the current language.
 *
 * Exposes `DICTIONARIES` and `useStrings`. Typed as a complete record, so
 * adding a language to `features/i18n` without its dictionary fails to compile.
 */
import { useLanguage } from '../features/i18n/index.ts';
import type { Language } from '../features/i18n/index.ts';
import { STRINGS_EN } from './strings.en.ts';
import { STRINGS_FR } from './strings.fr.ts';
import type { AppStrings } from './strings.fr.ts';

/** Every interface dictionary, one per language. */
export const DICTIONARIES: Readonly<Record<Language, AppStrings>> = {
  fr: STRINGS_FR,
  en: STRINGS_EN,
};

/**
 * Texts of the interface in the current language.
 *
 * @returns The dictionary of the language held by the nearest `LanguageProvider`.
 * @throws {Error} When called outside a `LanguageProvider`.
 */
export function useStrings(): AppStrings {
  return DICTIONARIES[useLanguage().language];
}
