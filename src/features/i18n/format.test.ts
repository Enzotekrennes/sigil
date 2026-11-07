/**
 * Unit tests of the language-aware formatting: decimal separator and plural
 * rule of each interface language.
 */
import { describe, expect, it } from 'vitest';

import { countNoun, formatDecimal } from './format.ts';

/** Forms of the noun used throughout these tests. */
const LETTER_FR = { one: 'lettre', other: 'lettres' };
const LETTER_EN = { one: 'letter', other: 'letters' };

describe('formatDecimal', () => {
  it('writes a decimal comma in French and a decimal point in English', () => {
    expect(formatDecimal(1.2, 'fr', 1)).toBe('1,2');
    expect(formatDecimal(1.2, 'en', 1)).toBe('1.2');
  });

  it('pads and rounds to the requested decimals', () => {
    expect(formatDecimal(4, 'fr', 1)).toBe('4,0');
    expect(formatDecimal(4, 'en', 1)).toBe('4.0');
    expect(formatDecimal(0.46, 'en', 1)).toBe('0.5');
  });
});

describe('countNoun', () => {
  it('uses the singular for 0 and 1 in French', () => {
    expect(countNoun(0, LETTER_FR, 'fr')).toBe('0 lettre');
    expect(countNoun(1, LETTER_FR, 'fr')).toBe('1 lettre');
    expect(countNoun(2, LETTER_FR, 'fr')).toBe('2 lettres');
  });

  it('uses the singular for 1 only in English', () => {
    expect(countNoun(0, LETTER_EN, 'en')).toBe('0 letters');
    expect(countNoun(1, LETTER_EN, 'en')).toBe('1 letter');
    expect(countNoun(11, LETTER_EN, 'en')).toBe('11 letters');
  });
});
