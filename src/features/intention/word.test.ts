/**
 * Unit tests of the single-word rule of the intention (plan decision D18).
 */
import { describe, expect, it } from 'vitest';

import { checkSingleWord, MAX_INTENTION_LETTERS, normalizeIntention } from './index.ts';

/** U+00A0, written by its code so the test shows it. */
const NO_BREAK_SPACE = String.fromCodePoint(0xa0);

describe('checkSingleWord', () => {
  it('accepts a single word, accents included', () => {
    expect(checkSingleWord('Calme')).toEqual({ ok: true });
    expect(checkSingleWord('Sérénité')).toEqual({ ok: true });
  });

  it('ignores whitespace around the word', () => {
    expect(checkSingleWord('  Calme \n')).toEqual({ ok: true });
    expect(checkSingleWord(`\tCalme${NO_BREAK_SPACE}`)).toEqual({ ok: true });
  });

  it('accepts apostrophes and hyphens inside the word, which the normalisation then drops', () => {
    expect(checkSingleWord("aujourd'hui")).toEqual({ ok: true });
    expect(checkSingleWord('aujourd’hui')).toEqual({ ok: true });
    expect(checkSingleWord('peut-être')).toEqual({ ok: true });

    const normalized = normalizeIntention('peut-être');
    expect(normalized.ok && normalized.intention).toMatchObject({
      letters: Array.from('PEUTETRE'),
      ignored: [],
    });
  });

  it('refuses a sentence of several words', () => {
    expect(checkSingleWord('Je suis calme')).toEqual({ ok: false, error: 'MULTIPLE_WORDS' });
    expect(checkSingleWord('I am calm')).toEqual({ ok: false, error: 'MULTIPLE_WORDS' });
  });

  it('treats tabs, line breaks and no-break spaces inside the text as word separators', () => {
    expect(checkSingleWord('calme\tserein')).toEqual({ ok: false, error: 'MULTIPLE_WORDS' });
    expect(checkSingleWord('calme\nserein')).toEqual({ ok: false, error: 'MULTIPLE_WORDS' });
    expect(checkSingleWord(`calme${NO_BREAK_SPACE}serein`)).toEqual({
      ok: false,
      error: 'MULTIPLE_WORDS',
    });
  });

  it('accepts French typography: a space before final punctuation, guillemets', () => {
    expect(checkSingleWord('Calme !')).toEqual({ ok: true });
    expect(checkSingleWord('Calme ?')).toEqual({ ok: true });
    expect(checkSingleWord(`Calme${NO_BREAK_SPACE}!`)).toEqual({ ok: true });
    expect(checkSingleWord(`«${NO_BREAK_SPACE}Calme${NO_BREAK_SPACE}»`)).toEqual({ ok: true });
    expect(checkSingleWord('« Calme » !')).toEqual({ ok: true });
  });

  it('accepts a word next to digits or symbols, which hold no Latin letter', () => {
    // « 2026 » is not a word: the normalisation then reports its digits as ignored.
    expect(checkSingleWord('Calme 2026')).toEqual({ ok: true });
    expect(checkSingleWord('Calme 😀 €')).toEqual({ ok: true });
    expect(checkSingleWord('мир Calme')).toEqual({ ok: true });
  });

  it('accepts punctuation without whitespace between letters as one word', () => {
    expect(checkSingleWord('je.suis.calme')).toEqual({ ok: true });
  });

  it('refuses two words even when punctuation surrounds them', () => {
    expect(checkSingleWord('« Calme » « serein »')).toEqual({
      ok: false,
      error: 'MULTIPLE_WORDS',
    });
    expect(checkSingleWord('Calme, serein !')).toEqual({ ok: false, error: 'MULTIPLE_WORDS' });
    expect(checkSingleWord('2026 a b')).toEqual({ ok: false, error: 'MULTIPLE_WORDS' });
  });

  it('refuses several words even when they are short and the letters fit the limit', () => {
    expect(checkSingleWord('a b')).toEqual({ ok: false, error: 'MULTIPLE_WORDS' });
  });

  it(`accepts exactly ${String(MAX_INTENTION_LETTERS)} letters`, () => {
    expect(MAX_INTENTION_LETTERS).toBe(24);
    expect(checkSingleWord('a'.repeat(MAX_INTENTION_LETTERS))).toEqual({ ok: true });
  });

  it('refuses a word longer than the limit, with its letter count', () => {
    // « anticonstitutionnellement » has 25 letters.
    expect(checkSingleWord('Anticonstitutionnellement')).toEqual({
      ok: false,
      error: 'TOO_LONG',
      letterCount: 25,
      maxLetters: 24,
    });
  });

  it('counts letters after normalisation: ß gives two letters, digits and hyphens none', () => {
    // 23 letters + ß (SS) = 25.
    expect(checkSingleWord(`${'a'.repeat(23)}ß`)).toMatchObject({
      error: 'TOO_LONG',
      letterCount: 25,
    });
    // 24 letters plus digits and hyphens that are not traced.
    expect(checkSingleWord(`${'a'.repeat(12)}-2026-${'b'.repeat(12)}`)).toEqual({ ok: true });
  });

  it('leaves empty and letterless texts to the normalisation', () => {
    expect(checkSingleWord('')).toEqual({ ok: true });
    expect(checkSingleWord('   ')).toEqual({ ok: true });
    expect(checkSingleWord('123!')).toEqual({ ok: true });
  });
});
