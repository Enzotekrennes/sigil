/**
 * Holds the interface language for the whole app and keeps the page in step
 * with it: the `lang` attribute of `<html>` and the choice saved in storage.
 *
 * Exposes `LanguageProvider`, `useLanguage` and `LanguageState`. Knows no
 * dictionary: the app picks its texts from the language this provides.
 * Changing the language re-renders the tree below without remounting it, so
 * the screen's state (intention typed, sigil shown, animation) is untouched.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { Language } from './language.ts';
import { initialLanguage, storeLanguage } from './storage.ts';
import type { LanguageStorage } from './storage.ts';

/** Current language and the way to change it. */
export interface LanguageState {
  /** Language the interface is shown in. */
  readonly language: Language;
  /** Switches the interface to `language` and remembers the choice for the next visits. */
  readonly setLanguage: (language: Language) => void;
}

/** Null outside a `LanguageProvider`, which `useLanguage` reports as a wiring error. */
const LanguageContext = createContext<LanguageState | null>(null);

/** Props of `LanguageProvider`. */
export interface LanguageProviderProps {
  /** The part of the app that reads the language. */
  readonly children: ReactNode;
}

/**
 * Chooses the language on mount (stored choice, else the browser's first
 * language) and provides it to its children.
 *
 * @returns The context provider around `children`.
 * @remarks Sets `document.documentElement.lang` on every change; writes the
 *   language code to `localStorage` when the user changes it, never on load.
 */
export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setCurrent] = useState(() =>
    initialLanguage(browserStorage(), browserLanguages()),
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const state = useMemo<LanguageState>(
    () => ({
      language,
      setLanguage: (next) => {
        storeLanguage(browserStorage(), next);
        setCurrent(next);
      },
    }),
    [language],
  );

  return <LanguageContext value={state}>{children}</LanguageContext>;
}

/**
 * Reads the interface language from the nearest `LanguageProvider`.
 *
 * @returns The current language and its setter.
 * @throws {Error} When called outside a `LanguageProvider` (a wiring mistake).
 */
export function useLanguage(): LanguageState {
  const state = useContext(LanguageContext);
  if (state === null) {
    throw new Error('useLanguage() needs a <LanguageProvider> above the component that calls it.');
  }
  return state;
}

/**
 * The browser's `localStorage`, if it can be reached at all.
 *
 * @returns The storage, or `undefined` when merely reading `window.localStorage`
 *   throws (storage blocked by the browser settings).
 */
function browserStorage(): LanguageStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    // Blocked storage: the language is then detected on every load.
    return undefined;
  }
}

/**
 * The browser's preferred languages, most preferred first.
 *
 * @returns `navigator.languages`, or `navigator.language` alone when the list is empty.
 */
function browserLanguages(): readonly string[] {
  return navigator.languages.length > 0 ? navigator.languages : [navigator.language];
}
