/**
 * Unit tests of the Spare seed (plan decision D6): it depends on the retained
 * letters, the vowel setting and the variant, and on nothing else.
 */
import { describe, expect, it } from 'vitest';

import { normalizeIntention, reduceForSpare } from '../intention/index.ts';
import { spareSeed } from './seed.ts';

/** Retained letters of "Je suis calme" with vowels removed. */
const JSCLM = ['J', 'S', 'C', 'L', 'M'];

/**
 * Normalises and reduces an intention, failing the test on any business error.
 *
 * @param source - Text as typed.
 * @returns The retained letters.
 */
function retainedLetters(source: string): string[] {
  const normalized = normalizeIntention(source);
  if (!normalized.ok) throw new Error(`Unexpected normalisation error ${normalized.error}`);
  const reduced = reduceForSpare(normalized.intention.letters, { keepVowels: false });
  if (!reduced.ok) throw new Error(`Unexpected reduction error ${reduced.error}`);
  return reduced.kept;
}

describe('spareSeed', () => {
  it('gives the same seed for the same input', () => {
    const input = { letters: JSCLM, keepVowels: false, variant: 3 };
    expect(spareSeed(input)).toBe(spareSeed({ ...input, letters: [...JSCLM] }));
  });

  it('gives a non-negative safe integer', () => {
    const seed = spareSeed({ letters: JSCLM, keepVowels: false, variant: 0 });
    expect(Number.isSafeInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
  });

  it('gives intentions that reduce to the same letters the same seed', () => {
    expect(retainedLetters('Je suis calme')).toEqual(JSCLM);
    expect(retainedLetters('je suis calme !')).toEqual(JSCLM);
    const seed = (source: string) =>
      spareSeed({ letters: retainedLetters(source), keepVowels: false, variant: 0 });
    expect(seed('je suis calme !')).toBe(seed('Je suis calme'));
  });

  it('gives each of the first thousand variants its own seed', () => {
    const seeds = Array.from({ length: 1000 }, (_, variant) =>
      spareSeed({ letters: JSCLM, keepVowels: false, variant }),
    );
    expect(new Set(seeds).size).toBe(1000);
  });

  it('changes with the letters, their order and the vowel setting', () => {
    const base = spareSeed({ letters: JSCLM, keepVowels: false, variant: 0 });
    expect(spareSeed({ letters: ['J', 'S', 'C', 'L'], keepVowels: false, variant: 0 })).not.toBe(
      base,
    );
    expect(
      spareSeed({ letters: ['S', 'J', 'C', 'L', 'M'], keepVowels: false, variant: 0 }),
    ).not.toBe(base);
    expect(spareSeed({ letters: JSCLM, keepVowels: true, variant: 0 })).not.toBe(base);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses the variant %s', (variant) => {
    expect(() => spareSeed({ letters: JSCLM, keepVowels: false, variant })).toThrow(RangeError);
  });
});
