/**
 * The interface languages and how the first one is chosen (scenario F6).
 *
 * Exposes `Language`, `LANGUAGES`, `DEFAULT_LANGUAGE`, `isLanguage` and
 * `detectLanguage`. Pure: reads nothing from the browser itself, the caller
 * passes the preferred languages in. Persistence lives in `storage.ts`.
 */

/** Languages the interface is written in, as BCP 47 primary subtags. */
export const LANGUAGES = ['fr', 'en'] as const;

/** An interface language. */
export type Language = (typeof LANGUAGES)[number];

/** Language used when the browser does not ask for English: the project's own language. */
export const DEFAULT_LANGUAGE: Language = 'fr';

/** Primary subtag that switches the first load to English. */
const ENGLISH_PREFIX = 'en';

/**
 * Tells whether a value is one of the interface languages.
 *
 * @param value - Anything, typically a value read back from storage.
 * @returns True for exactly `'fr'` or `'en'`.
 */
export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language === value);
}

/**
 * Language of the first load: English when the browser's first preferred
 * language is English (`en`, `en-US`, `en-GB`…), French otherwise.
 *
 * @param preferred - The browser's languages in order of preference
 *   (`navigator.languages`); may be empty.
 * @returns `'en'` or `'fr'`; `'fr'` for an empty list.
 */
export function detectLanguage(preferred: readonly string[]): Language {
  const first = preferred[0];
  if (first === undefined) return DEFAULT_LANGUAGE;
  return first.trim().toLowerCase().startsWith(ENGLISH_PREFIX) ? 'en' : DEFAULT_LANGUAGE;
}
