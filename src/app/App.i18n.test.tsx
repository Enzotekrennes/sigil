/**
 * Component tests of the bilingual interface (scenario F6): language on first
 * load (stored choice, else the browser's), the FR | EN switch in the header,
 * what the switch keeps (intention, sigil, animation) and writes (the
 * language code only), and a check that no visible or accessible text escapes
 * the dictionaries.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LANGUAGE_STORAGE_KEY } from '../features/i18n/index.ts';
import type { Language } from '../features/i18n/index.ts';
import { App } from './App.tsx';

/**
 * Sets the browser's preferred languages seen by the app.
 *
 * @param languages - `navigator.languages`, most preferred first.
 */
function browserLanguages(...languages: string[]): void {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
}

/**
 * Picks a language in the header selector.
 *
 * @param name - Name of the language as announced ("Français", "English").
 */
function pickLanguage(name: 'Français' | 'English'): void {
  fireEvent.click(screen.getByRole('radio', { name }));
}

/**
 * Types an intention in the field, whatever the interface language.
 *
 * @param text - Text to type.
 */
function typeIntention(text: string): void {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
}

/**
 * Presses the trace button.
 *
 * @param name - Its label in the current language.
 */
function clickTrace(name: 'Tracer' | 'Trace'): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

/**
 * Every visible text and accessible name of the page, minus the parts
 * explicitly marked as written in another language (the language names of
 * the selector, which stay in their own language).
 *
 * @param language - The interface language expected on screen.
 * @returns Text content plus the `aria-label`, `aria-valuetext`, `title`,
 *   `alt` and `placeholder` attributes, as one string.
 */
function pageTexts(language: Language): string {
  const copy = document.body.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(`[lang]:not([lang="${language}"])`).forEach((element) => {
    element.remove();
  });
  const attributes = ['aria-label', 'aria-valuetext', 'title', 'alt', 'placeholder'];
  const attributeTexts = Array.from(copy.querySelectorAll('*')).flatMap((element) =>
    attributes.map((name) => element.getAttribute(name) ?? ''),
  );
  // One entry per text node: textContent would glue the words of adjacent elements.
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  const nodeTexts: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    nodeTexts.push(node.textContent ?? '');
  }
  return [...nodeTexts, ...attributeTexts].join(' ');
}

/**
 * Every key and value of `localStorage`.
 *
 * @returns The stored entries as a plain object.
 */
function storedEntries(): Record<string, string | null> {
  return Object.fromEntries(
    Array.from({ length: localStorage.length }, (_, index) => {
      const key = localStorage.key(index) ?? '';
      return [key, localStorage.getItem(key)];
    }),
  );
}

/**
 * Words of a text, lower-cased, apostrophes kept inside words.
 *
 * @param text - Any text.
 * @returns The set of its words.
 */
function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[\p{L}’']+/gu) ?? []);
}

/** Common French words that never appear in the English interface. */
const FRENCH_WITNESSES = [
  'tracer',
  'rejouer',
  'méthode',
  'carré',
  'saturne',
  'lettre',
  'lettres',
  'voyelles',
  'garder',
  'épaisseur',
  'exporter',
  'comment',
  'étape',
  'aucune',
  'retirée',
  'gardée',
  'variante',
  'oui',
  'non',
  'cercle',
  'chemin',
  'règle',
  'rang',
  'doublons',
  'écrivez',
  'caractères',
  'langue',
  'les',
  'des',
  'une',
  'est',
  'sur',
];

/** Common English words that never appear in the French interface. */
const ENGLISH_WITNESSES = [
  'trace',
  'replay',
  'method',
  'square',
  'letter',
  'letters',
  'vowels',
  'keep',
  'stroke',
  'width',
  'export',
  'how',
  'step',
  'none',
  'kept',
  'removed',
  'variant',
  'the',
  'and',
  'of',
  'with',
  'write',
  'language',
  'cell',
  'rank',
  'path',
  'rounded',
  'framing',
];

/**
 * Walks the screen through its main states (empty, kamea traced with an
 * ignored character, Spare traced, an error with its action, the empty
 * intention error) and gathers the texts of each.
 *
 * @param language - The interface language, which sets the button labels.
 * @returns All texts met, as one string.
 */
function textsOfEveryState(language: Language): string {
  const trace = language === 'fr' ? 'Tracer' : 'Trace';
  const texts = [pageTexts(language)];

  typeIntention('Calm mind 2');
  clickTrace(trace);
  texts.push(pageTexts(language));

  fireEvent.click(screen.getByRole('radio', { name: 'Spare' }));
  clickTrace(trace);
  texts.push(pageTexts(language));

  typeIntention('aeiou');
  clickTrace(trace);
  texts.push(pageTexts(language));

  typeIntention('');
  clickTrace(trace);
  texts.push(pageTexts(language));

  return texts.join(' ');
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.lang = 'fr';
});

describe('language on first load', () => {
  it('shows English when the browser asks for English first', () => {
    browserLanguages('en-US', 'fr-FR');
    render(<App />);

    expect(screen.getByRole('button', { name: 'Trace' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    expect(document.documentElement.lang).toBe('en');
  });

  it('shows French for any other first language', () => {
    browserLanguages('de-DE', 'en-US');
    render(<App />);

    expect(screen.getByRole('button', { name: 'Tracer' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Français' })).toBeChecked();
    expect(document.documentElement.lang).toBe('fr');
  });

  it('follows the stored choice over the browser', () => {
    browserLanguages('en-US');
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    render(<App />);

    expect(screen.getByRole('button', { name: 'Tracer' })).toBeInTheDocument();
  });

  it('falls back to detection on an invalid stored value', () => {
    browserLanguages('en-GB');
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    render(<App />);

    expect(screen.getByRole('button', { name: 'Trace' })).toBeInTheDocument();
  });

  it('falls back to detection when storage cannot be read', () => {
    browserLanguages('en-GB');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    render(<App />);

    expect(screen.getByRole('button', { name: 'Trace' })).toBeInTheDocument();
  });

  it('writes nothing to storage until the user picks a language', () => {
    browserLanguages('en-US');
    render(<App />);

    expect(localStorage).toHaveLength(0);
  });
});

describe('language switch', () => {
  it('sits in the header as a labelled group of two languages', () => {
    browserLanguages('fr-FR');
    render(<App />);

    const group = screen.getByRole('group', { name: 'Langue de l’interface' });
    expect(group.closest('header')).not.toBeNull();
    expect(screen.getAllByRole('radio', { name: /^(Français|English)$/ })).toHaveLength(2);
  });

  it('translates the whole screen, sets <html lang> and saves the code only', () => {
    browserLanguages('fr-FR');
    render(<App />);

    pickLanguage('English');

    expect(screen.getByRole('button', { name: 'Trace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How it’s made' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Interface language' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(storedEntries()).toEqual({ [LANGUAGE_STORAGE_KEY]: 'en' });

    pickLanguage('Français');

    expect(screen.getByRole('button', { name: 'Tracer' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fr');
    expect(storedEntries()).toEqual({ [LANGUAGE_STORAGE_KEY]: 'fr' });
  });

  it('keeps the intention, the sigil and its animation run', () => {
    browserLanguages('fr-FR');
    render(<App />);
    typeIntention('Je suis calme');
    clickTrace('Tracer');
    const sigil = screen.getByRole('img', { name: 'Sigil kamea de Saturne' });
    const run = sigil.querySelector('[data-run]')?.getAttribute('data-run');
    const strokes = sigil.innerHTML;

    pickLanguage('English');

    expect(screen.getByRole('textbox')).toHaveValue('Je suis calme');
    const translated = screen.getByRole('img', { name: 'Kamea sigil of Saturn' });
    expect(translated.querySelector('[data-run]')?.getAttribute('data-run')).toBe(run);
    expect(translated.innerHTML).toBe(strokes);
    expect(
      screen.getByText('Sigil traced: 11 letters on the square of Saturn.'),
    ).toBeInTheDocument();
  });

  it('keeps the Spare variant shown', () => {
    browserLanguages('fr-FR');
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'Spare' }));
    typeIntention('Je suis calme');
    clickTrace('Tracer');
    fireEvent.click(screen.getByRole('button', { name: 'Autre variante' }));
    const strokes = screen.getByRole('img', { name: 'Sigil de Spare, variante 2' }).innerHTML;

    pickLanguage('English');

    expect(screen.getByRole('img', { name: 'Spare sigil, variant 2' }).innerHTML).toBe(strokes);
  });

  it('translates an error already shown under the field', () => {
    browserLanguages('fr-FR');
    render(<App />);
    clickTrace('Tracer');
    expect(screen.getByText(/Écrivez une intention avant de tracer/)).toBeInTheDocument();

    pickLanguage('English');

    expect(screen.getByText(/Write an intention before tracing/)).toBeInTheDocument();
  });

  it('writes the stroke width with the decimal separator of the language', () => {
    browserLanguages('fr-FR');
    render(<App />);
    expect(screen.getByText('fin · 1,2')).toBeInTheDocument();

    pickLanguage('English');

    expect(screen.getByText('thin · 1.2')).toBeInTheDocument();
  });
});

describe('no text outside the dictionaries', () => {
  it('shows no French word in the English interface', () => {
    browserLanguages('en-US');
    render(<App />);

    const found = [...words(textsOfEveryState('en'))].filter((word) =>
      FRENCH_WITNESSES.includes(word),
    );

    expect(found).toEqual([]);
  });

  it('shows no English word in the French interface', () => {
    browserLanguages('fr-FR');
    render(<App />);

    const found = [...words(textsOfEveryState('fr'))].filter((word) =>
      ENGLISH_WITNESSES.includes(word),
    );

    expect(found).toEqual([]);
  });

  it('really walks through texts of both kinds (guards the two tests above)', () => {
    browserLanguages('en-US');
    render(<App />);
    const english = words(textsOfEveryState('en'));

    expect(english).toContain('vowels');
    expect(english).toContain('duplicates');
    expect(english).toContain('ignored');
  });
});
