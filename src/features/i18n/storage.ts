/**
 * Remembers the interface language the user picked, in `localStorage`.
 *
 * Exposes `LANGUAGE_STORAGE_KEY`, `readStoredLanguage`, `storeLanguage` and
 * `initialLanguage`. Only the language code (`'fr'` or `'en'`) is ever
 * written, never the intention (decision D8). Reading is tolerant: a missing
 * or invalid value, or a storage that throws (private mode, blocked cookies),
 * falls back to detection from the browser's languages.
 */
import { detectLanguage, isLanguage } from './language.ts';
import type { Language } from './language.ts';

/**
 * Key of the language choice in `localStorage`. Its value is `'fr'` or `'en'`
 * and nothing else; it is written only when the user picks a language, so a
 * visitor who never touches the selector leaves storage empty.
 */
export const LANGUAGE_STORAGE_KEY = 'sigil.language';

/** The part of the Web Storage API this module uses, so tests can pass a fake. */
export type LanguageStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Reads the language the user picked earlier.
 *
 * @param storage - Where the choice is kept; `undefined` when the browser offers none.
 * @returns The stored language, or `null` when nothing valid is stored or the
 *   storage cannot be read. Never throws.
 */
export function readStoredLanguage(storage: LanguageStorage | undefined): Language | null {
  if (storage === undefined) return null;
  try {
    const value = storage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    // Storage disabled or blocked: behave as if nothing were stored.
    return null;
  }
}

/**
 * Remembers the language the user just picked.
 *
 * @param storage - Where to keep the choice; `undefined` when the browser offers none.
 * @param language - The language picked.
 * @returns True when the choice was saved; false when storage is missing or
 *   refused the write (the choice then lasts until the page is closed). Never throws.
 * @remarks Writes one key of `localStorage`; logs a warning when the write fails.
 */
export function storeLanguage(storage: LanguageStorage | undefined, language: Language): boolean {
  if (storage === undefined) return false;
  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, language);
    return true;
  } catch (error) {
    console.warn(
      `Cannot save the interface language in localStorage ("${LANGUAGE_STORAGE_KEY}"): the choice will not survive a reload.`,
      error,
    );
    return false;
  }
}

/**
 * Language to show on load: the stored choice if valid, otherwise the one
 * detected from the browser's preferred languages.
 *
 * @param storage - Where the choice is kept, if anywhere.
 * @param preferred - The browser's languages in order of preference.
 * @returns The language to render with. Never throws.
 */
export function initialLanguage(
  storage: LanguageStorage | undefined,
  preferred: readonly string[],
): Language {
  return readStoredLanguage(storage) ?? detectLanguage(preferred);
}
