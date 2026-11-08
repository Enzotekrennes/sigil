/**
 * Unit tests of the colour theme: what is stored (the theme name only, under
 * one documented key, nothing for the system setting), the tolerant reading
 * (invalid value or unusable storage → system setting), how a choice reaches
 * `<html>` and the `theme-color` metadata, and the start-up script
 * `public/theme-init.js`, which must read the same key and values.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import themeInitSource from '../../public/theme-init.js?raw';
import {
  applyTheme,
  readStoredTheme,
  storeTheme,
  THEME_BACKGROUNDS,
  THEME_STORAGE_KEY,
} from './theme.ts';
import type { ThemeStorage } from './theme.ts';

/**
 * In-memory storage, inspectable by the tests.
 *
 * @param entries - Initial content.
 * @returns The fake storage and its backing map.
 */
function memoryStorage(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));
  const storage: ThemeStorage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
  return { storage, map };
}

/** Storage whose every access throws, as when the browser blocks site data. */
const BROKEN_STORAGE: ThemeStorage = {
  getItem: () => {
    throw new DOMException('Blocked', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('Quota', 'QuotaExceededError');
  },
  removeItem: () => {
    throw new DOMException('Blocked', 'SecurityError');
  },
};

/**
 * Runs `public/theme-init.js` in the test document, as the browser does
 * before the app starts.
 */
function runThemeInitScript(): void {
  const script = document.createElement('script');
  script.textContent = themeInitSource;
  document.head.append(script);
  script.remove();
}

/**
 * Content of the `theme-color` metadata, in document order.
 *
 * @returns One colour per `<meta name="theme-color">`.
 */
function themeColors(): (string | null)[] {
  return Array.from(document.querySelectorAll('meta[name="theme-color"]'), (meta) =>
    meta.getAttribute('content'),
  );
}

beforeEach(() => {
  document.head.innerHTML = `
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f3eee3" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0f0e0c" />`;
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
  document.head.innerHTML = '';
  localStorage.clear();
});

describe('readStoredTheme', () => {
  it.each([['light'], ['dark']] as const)('returns the stored %s', (theme) => {
    const { storage } = memoryStorage({ [THEME_STORAGE_KEY]: theme });
    expect(readStoredTheme(storage)).toBe(theme);
  });

  it.each([['system'], ['Dark'], ['gold'], [''], ['{"theme":"dark"}']])(
    'falls back to the system setting on the invalid value %j',
    (value) => {
      const { storage } = memoryStorage({ [THEME_STORAGE_KEY]: value });
      expect(readStoredTheme(storage)).toBe('system');
    },
  );

  it('follows the system when nothing is stored, storage is missing or throws', () => {
    expect(readStoredTheme(memoryStorage().storage)).toBe('system');
    expect(readStoredTheme(undefined)).toBe('system');
    expect(readStoredTheme(BROKEN_STORAGE)).toBe('system');
  });
});

describe('storeTheme', () => {
  it('writes the theme name alone under the documented key', () => {
    const { storage, map } = memoryStorage();

    expect(storeTheme(storage, 'dark')).toBe(true);

    expect(Object.fromEntries(map)).toEqual({ 'sigil.theme': 'dark' });
  });

  it('removes the key when going back to the system setting', () => {
    const { storage, map } = memoryStorage({ [THEME_STORAGE_KEY]: 'light', other: 'kept' });

    expect(storeTheme(storage, 'system')).toBe(true);

    expect(Object.fromEntries(map)).toEqual({ other: 'kept' });
  });

  it('reports a refused write without throwing, and logs why', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(storeTheme(BROKEN_STORAGE, 'dark')).toBe(false);
    expect(storeTheme(BROKEN_STORAGE, 'system')).toBe(false);
    expect(storeTheme(undefined, 'light')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('applyTheme', () => {
  it('sets data-theme for an explicit theme and points theme-color at its background', () => {
    applyTheme(document.documentElement, 'dark');

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(themeColors()).toEqual([THEME_BACKGROUNDS.dark, THEME_BACKGROUNDS.dark]);

    applyTheme(document.documentElement, 'light');

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(themeColors()).toEqual([THEME_BACKGROUNDS.light, THEME_BACKGROUNDS.light]);
  });

  it('removes data-theme for the system setting and gives each scheme its own colour back', () => {
    applyTheme(document.documentElement, 'dark');
    applyTheme(document.documentElement, 'system');

    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(themeColors()).toEqual([THEME_BACKGROUNDS.light, THEME_BACKGROUNDS.dark]);
  });
});

describe('public/theme-init.js', () => {
  it.each([['light'], ['dark']] as const)(
    'applies a stored %s theme before the app starts',
    (theme) => {
      localStorage.setItem(THEME_STORAGE_KEY, theme);

      runThemeInitScript();

      expect(document.documentElement).toHaveAttribute('data-theme', theme);
    },
  );

  it.each([['system'], ['gold'], ['']])('leaves the system setting on %j', (value) => {
    localStorage.setItem(THEME_STORAGE_KEY, value);

    runThemeInitScript();

    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('never writes storage', () => {
    runThemeInitScript();

    expect(localStorage).toHaveLength(0);
  });
});
