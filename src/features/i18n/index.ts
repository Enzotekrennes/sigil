/**
 * Public API of the i18n feature: the interface languages, their detection
 * and persistence, the provider and hook that hold the current language, the
 * header selector, and the language-aware number and plural formatting.
 * The dictionaries themselves live with the app (`src/app/strings.*.ts`).
 */
export { countNoun, formatDecimal } from './format.ts';
export type { NounForms } from './format.ts';
export { DEFAULT_LANGUAGE, detectLanguage, isLanguage, LANGUAGES } from './language.ts';
export type { Language } from './language.ts';
export { LanguageProvider, useLanguage } from './LanguageProvider.tsx';
export type { LanguageProviderProps, LanguageState } from './LanguageProvider.tsx';
export { LanguageToggle } from './LanguageToggle.tsx';
export type { LanguageToggleProps, LanguageToggleStrings } from './LanguageToggle.tsx';
export {
  initialLanguage,
  LANGUAGE_STORAGE_KEY,
  readStoredLanguage,
  storeLanguage,
} from './storage.ts';
export type { LanguageStorage } from './storage.ts';
