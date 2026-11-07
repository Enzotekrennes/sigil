/**
 * Unit tests of the language persistence: what is written (the language code
 * only, under one documented key) and the tolerant reading (invalid value or
 * unusable storage → detection from the browser).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  initialLanguage,
  LANGUAGE_STORAGE_KEY,
  readStoredLanguage,
  storeLanguage,
} from './storage.ts';
import type { LanguageStorage } from './storage.ts';

/**
 * In-memory storage, inspectable by the tests.
 *
 * @param entries - Initial content.
 * @returns The fake storage and its backing map.
 */
function memoryStorage(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));
  const storage: LanguageStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
  return { storage, map };
}

/** Storage whose every access throws, as when the browser blocks site data. */
const BROKEN_STORAGE: LanguageStorage = {
  getItem: () => {
    throw new DOMException('Blocked', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('Quota', 'QuotaExceededError');
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readStoredLanguage', () => {
  it.each([['fr'], ['en']] as const)('returns the stored %s', (language) => {
    const { storage } = memoryStorage({ [LANGUAGE_STORAGE_KEY]: language });
    expect(readStoredLanguage(storage)).toBe(language);
  });

  it.each([['de'], ['EN'], ['en-US'], [''], ['{"language":"en"}']])(
    'ignores the invalid value %j',
    (value) => {
      const { storage } = memoryStorage({ [LANGUAGE_STORAGE_KEY]: value });
      expect(readStoredLanguage(storage)).toBeNull();
    },
  );

  it('returns null when nothing is stored, storage is missing or throws', () => {
    expect(readStoredLanguage(memoryStorage().storage)).toBeNull();
    expect(readStoredLanguage(undefined)).toBeNull();
    expect(readStoredLanguage(BROKEN_STORAGE)).toBeNull();
  });
});

describe('storeLanguage', () => {
  it('writes the language code alone under the documented key', () => {
    const { storage, map } = memoryStorage();

    expect(storeLanguage(storage, 'en')).toBe(true);

    expect(Object.fromEntries(map)).toEqual({ 'sigil.language': 'en' });
  });

  it('reports a refused write without throwing, and logs why', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(storeLanguage(BROKEN_STORAGE, 'fr')).toBe(false);
    expect(storeLanguage(undefined, 'fr')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('initialLanguage', () => {
  it('prefers the stored choice over the browser languages', () => {
    const { storage } = memoryStorage({ [LANGUAGE_STORAGE_KEY]: 'fr' });
    expect(initialLanguage(storage, ['en-US'])).toBe('fr');
  });

  it('detects from the browser when the stored value is invalid', () => {
    const { storage } = memoryStorage({ [LANGUAGE_STORAGE_KEY]: 'klingon' });
    expect(initialLanguage(storage, ['en-US'])).toBe('en');
  });

  it('detects from the browser when storage is unavailable', () => {
    expect(initialLanguage(BROKEN_STORAGE, ['en-GB'])).toBe('en');
    expect(initialLanguage(undefined, ['fr-CA'])).toBe('fr');
  });
});
