/**
 * Unit tests of the Spare letter reduction (plan decision D4).
 */
import { describe, expect, it } from 'vitest';

import { reduceForSpare } from './index.ts';

/**
 * Splits a word into its letters, as `normalizeIntention` returns them.
 *
 * @param word - Uppercase letters A–Z.
 * @returns One entry per letter.
 */
function lettersOf(word: string): string[] {
  return Array.from(word);
}

describe('reduceForSpare', () => {
  it('reduces JESUISCALME to J S C L M and traces each removal', () => {
    const result = reduceForSpare(lettersOf('JESUISCALME'), { keepVowels: false });

    expect(result).toEqual({
      ok: true,
      kept: ['J', 'S', 'C', 'L', 'M'],
      removed: [
        { letter: 'E', position: 1, reason: 'vowel' },
        { letter: 'U', position: 3, reason: 'vowel' },
        { letter: 'I', position: 4, reason: 'vowel' },
        { letter: 'S', position: 5, reason: 'duplicate' },
        { letter: 'A', position: 7, reason: 'vowel' },
        { letter: 'E', position: 10, reason: 'duplicate' },
      ],
    });
  });

  it('keeps vowels on request and still removes duplicates', () => {
    const result = reduceForSpare(lettersOf('JESUISCALME'), { keepVowels: true });

    expect(result).toEqual({
      ok: true,
      kept: ['J', 'E', 'S', 'U', 'I', 'C', 'A', 'L', 'M'],
      removed: [
        { letter: 'S', position: 5, reason: 'duplicate' },
        { letter: 'E', position: 10, reason: 'duplicate' },
      ],
    });
  });

  it('keeps the first occurrence of a repeated consonant, in order', () => {
    const result = reduceForSpare(lettersOf('BRBRT'), { keepVowels: false });

    expect(result.ok && result.kept).toEqual(['B', 'R', 'T']);
  });

  it('treats Y as a consonant', () => {
    const result = reduceForSpare(lettersOf('YEUX'), { keepVowels: false });

    expect(result.ok && result.kept).toEqual(['Y', 'X']);
  });

  it('fails on « oui » without vowels and suggests keeping them', () => {
    expect(reduceForSpare(lettersOf('OUI'), { keepVowels: false })).toEqual({
      ok: false,
      error: 'NO_LETTER_LEFT',
      suggestKeepVowels: true,
    });
  });

  it('keeps « oui » whole when vowels are kept', () => {
    const result = reduceForSpare(lettersOf('OUI'), { keepVowels: true });

    expect(result).toEqual({ ok: true, kept: ['O', 'U', 'I'], removed: [] });
  });

  it('fails without suggestion when there are no letters at all', () => {
    expect(reduceForSpare([], { keepVowels: true })).toEqual({
      ok: false,
      error: 'NO_LETTER_LEFT',
      suggestKeepVowels: false,
    });
  });

  it('does not modify the letters it receives', () => {
    const letters = lettersOf('ABBA');

    reduceForSpare(letters, { keepVowels: false });

    expect(letters).toEqual(['A', 'B', 'B', 'A']);
  });
});
