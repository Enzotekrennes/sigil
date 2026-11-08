/**
 * The colour theme of the page: "ink on paper", "gold on black", or the
 * system setting (decision D10: the system setting until the user picks one).
 *
 * Exposes `ThemeChoice`, `THEME_CHOICES`, `THEME_STORAGE_KEY`,
 * `THEME_BACKGROUNDS`, `readStoredTheme`, `storeTheme`, `applyTheme` and the
 * `useTheme` hook. The theme is carried by the `data-theme` attribute of
 * `<html>` (`light` or `dark`; absent = follow `prefers-color-scheme`), which
 * `src/styles/tokens.css` turns into colours. Only the theme name is ever
 * stored, never the intention (decision D8).
 *
 * Before the app starts, `public/theme-init.js` applies the stored theme with
 * the same key and values, so the page is painted in the right colours from
 * the start; this module takes over once React has mounted.
 */
import { useEffect, useState } from 'react';

/** Theme choices offered in the header, in display order. */
export const THEME_CHOICES = ['system', 'light', 'dark'] as const;

/** `system` follows `prefers-color-scheme`; `light` is ink on paper; `dark` is gold on black. */
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** A theme chosen explicitly: the only values ever stored or put in `data-theme`. */
type ExplicitTheme = Exclude<ThemeChoice, 'system'>;

/**
 * Key of the theme in `localStorage`. Its value is `'light'` or `'dark'` and
 * nothing else; it is written only when the user picks a theme and removed
 * when they go back to the system setting, so a visitor who never touches the
 * selector leaves storage empty. `public/theme-init.js` reads the same key.
 */
export const THEME_STORAGE_KEY = 'sigil.theme';

/**
 * Page background of each theme (`--color-bg` in `src/styles/tokens.css`),
 * given to the browser's `theme-color` so its toolbar matches the page.
 */
export const THEME_BACKGROUNDS: Readonly<Record<ExplicitTheme, string>> = {
  light: '#f3eee3',
  dark: '#0f0e0c',
};

/** Attribute of `<html>` read by the theme tokens. */
const THEME_ATTRIBUTE = 'data-theme';

/** The part of the Web Storage API this module uses, so tests can pass a fake. */
export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Tells whether a value is a theme that can be stored.
 *
 * @param value - Anything, typically a value read back from storage.
 * @returns True for exactly `'light'` or `'dark'`.
 */
function isExplicitTheme(value: unknown): value is ExplicitTheme {
  return value === 'light' || value === 'dark';
}

/**
 * Reads the theme the user picked earlier.
 *
 * @param storage - Where the choice is kept; `undefined` when the browser offers none.
 * @returns The stored theme, or `'system'` when nothing valid is stored or the
 *   storage cannot be read. Never throws.
 */
export function readStoredTheme(storage: ThemeStorage | undefined): ThemeChoice {
  if (storage === undefined) return 'system';
  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    return isExplicitTheme(value) ? value : 'system';
  } catch {
    // Storage disabled or blocked: behave as if nothing were stored.
    return 'system';
  }
}

/**
 * Remembers the theme the user just picked; going back to the system setting
 * removes the key instead of storing `'system'`.
 *
 * @param storage - Where to keep the choice; `undefined` when the browser offers none.
 * @param choice - The theme picked.
 * @returns True when the choice was saved; false when storage is missing or
 *   refused the write (the choice then lasts until the page is closed). Never throws.
 * @remarks Writes or removes one key of `localStorage`; logs a warning when that fails.
 */
export function storeTheme(storage: ThemeStorage | undefined, choice: ThemeChoice): boolean {
  if (storage === undefined) return false;
  try {
    if (choice === 'system') storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, choice);
    return true;
  } catch (error) {
    console.warn(
      `Cannot save the theme in localStorage ("${THEME_STORAGE_KEY}"): the choice will not survive a reload.`,
      error,
    );
    return false;
  }
}

/**
 * Shows the page in a theme: sets or removes `data-theme` on the root element,
 * and points the `theme-color` metadata at the theme's background.
 *
 * @param root - The `<html>` element of the document.
 * @param choice - Theme to show; `system` removes the attribute so the tokens
 *   follow `prefers-color-scheme`.
 * @remarks Mutates the root element and the `<meta name="theme-color">`
 *   elements of its document. Each meta keeps its `media` query; in system
 *   mode each gets the background of the scheme its query names, otherwise
 *   all get the chosen theme's background.
 */
export function applyTheme(root: HTMLElement, choice: ThemeChoice): void {
  if (choice === 'system') root.removeAttribute(THEME_ATTRIBUTE);
  else root.setAttribute(THEME_ATTRIBUTE, choice);

  root.ownerDocument.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const scheme = meta.getAttribute('media')?.includes('dark') === true ? 'dark' : 'light';
    meta.setAttribute('content', THEME_BACKGROUNDS[choice === 'system' ? scheme : choice]);
  });
}

/** Current theme choice and the way to change it. */
export interface ThemeState {
  /** Theme picked, `system` when the page follows the system setting. */
  readonly theme: ThemeChoice;
  /** Switches the page to `choice` and remembers it for the next visits. */
  readonly setTheme: (choice: ThemeChoice) => void;
}

/**
 * Holds the theme choice of the page: the stored one on mount, else the
 * system setting.
 *
 * @returns The current choice and its setter.
 * @remarks Applies the theme to `<html>` on mount and on every change (see
 *   `applyTheme`); writes `localStorage` only when the user changes the theme.
 */
export function useTheme(): ThemeState {
  const [theme, setCurrent] = useState(() => readStoredTheme(browserStorage()));

  useEffect(() => {
    applyTheme(document.documentElement, theme);
  }, [theme]);

  return {
    theme,
    setTheme: (choice) => {
      storeTheme(browserStorage(), choice);
      setCurrent(choice);
    },
  };
}

/**
 * The browser's `localStorage`, if it can be reached at all.
 *
 * @returns The storage, or `undefined` when merely reading `window.localStorage`
 *   throws (storage blocked by the browser settings).
 */
function browserStorage(): ThemeStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    // Blocked storage: the theme then follows the system on every load.
    return undefined;
  }
}
