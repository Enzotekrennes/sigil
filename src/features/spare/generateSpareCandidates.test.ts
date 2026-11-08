/**
 * Unit tests of the Spare candidate generation: seed (D6), determinism,
 * order and style of each variant, every candidate fitted in the disc with
 * its stem on the frame's axis, letters reported in the order given, the
 * number of candidates per word length, and business errors on invalid input.
 */
import { describe, expect, it } from 'vitest';

import { createRandom } from '../../lib/random.ts';
import { FRAME_SIZE } from '../sigil/frame.ts';
import {
  DISC_RADIUS,
  LONG_WORD_STYLES,
  SHORT_WORD_STYLES,
  letterOrderFor,
  styleFor,
} from './generateSpareCandidates.ts';
import {
  MAX_CANDIDATE_COUNT,
  MIN_CANDIDATE_COUNT,
  candidateCountFor,
  generateSpareCandidates,
  spareSeed,
} from './index.ts';
import type { SpareCandidateOptions, SpareCandidates, SpareCompositionError } from './index.ts';

/** Retained letters of "Calme" with vowels removed. */
const CLM = ['C', 'L', 'M'];

/** First variant with vowels removed, the default settings. */
const DEFAULT_OPTIONS: SpareCandidateOptions = { keepVowels: false, variant: 0 };

/** Letter sets covering a single letter, a short word and a long one. */
const LETTER_SETS: readonly (readonly string[])[] = [
  ['W'],
  CLM,
  ['S', 'T', 'R', 'N', 'G', 'H'],
  ['B', 'D', 'F', 'G', 'H', 'K', 'N', 'P', 'Q', 'R', 'T', 'V'],
];

/** Tolerance above the 4-decimal rounding of coordinates. */
const ROUNDING_TOLERANCE = 1e-3;

/**
 * Generates candidates and fails the test on a business error.
 *
 * @param letters - Retained letters.
 * @param options - Settings.
 * @returns The candidates and their seed.
 */
function generate(
  letters: readonly string[],
  options: SpareCandidateOptions = DEFAULT_OPTIONS,
): SpareCandidates {
  const result = generateSpareCandidates(letters, options);
  if (!result.ok) throw new Error(`Unexpected Spare error ${result.error.code}`);
  return result.data;
}

/**
 * Generates candidates and returns the business error, failing the test otherwise.
 *
 * @param letters - Letters as received.
 * @param options - Settings.
 * @returns The error.
 */
function generateError(
  letters: readonly string[],
  options: SpareCandidateOptions = DEFAULT_OPTIONS,
): SpareCompositionError {
  const result = generateSpareCandidates(letters, options);
  if (result.ok) throw new Error('Expected a Spare error');
  return result.error;
}

describe('generateSpareCandidates', () => {
  it('draws as many candidates as the budget allows, from the D6 seed', () => {
    const { seed, candidates } = generate(CLM);
    expect(seed).toBe(spareSeed({ letters: CLM, ...DEFAULT_OPTIONS }));
    expect(candidates).toHaveLength(candidateCountFor(3));
  });

  it('gives deeply equal results for the same letters and settings', () => {
    expect(generate(CLM)).toEqual(generate(CLM));
  });

  it('gives each variant its own seed and candidates', () => {
    const first = generate(CLM);
    const second = generate(CLM, { keepVowels: false, variant: 1 });
    expect(second.seed).not.toBe(first.seed);
    expect(second.candidates).not.toEqual(first.candidates);
  });

  it('fits every candidate in the disc, its stem on the frame axis', () => {
    const centre = FRAME_SIZE / 2;
    for (const letters of LETTER_SETS) {
      for (const variant of [0, 1, 2]) {
        for (const candidate of generate(letters, { keepVowels: true, variant }).candidates) {
          expect(candidate.stem.top.x).toBe(centre);
          expect(candidate.stem.bottom.x).toBe(centre);
          expect(candidate.strokes[0]).toEqual([candidate.stem.top, candidate.stem.bottom]);
          const points = [
            ...candidate.strokes.flat(),
            ...candidate.letters.flatMap((letter) => letter.strokes.flat()),
          ];
          for (const point of points) {
            expect(Math.hypot(point.x - centre, point.y - centre)).toBeLessThanOrEqual(
              DISC_RADIUS + ROUNDING_TOLERANCE,
            );
          }
        }
      }
    }
  });

  it('reports the letters in the order given, each within the stem', () => {
    const { candidates } = generate(['S', 'T', 'R', 'N', 'G', 'H'], {
      keepVowels: false,
      variant: 1,
    });
    for (const candidate of candidates) {
      expect(candidate.letters.map((letter) => letter.letter)).toEqual([
        'S',
        'T',
        'R',
        'N',
        'G',
        'H',
      ]);
      for (const letter of candidate.letters) {
        expect(letter.top).toBeLessThan(letter.bottom);
        expect(letter.top).toBeGreaterThanOrEqual(candidate.stem.top.y - ROUNDING_TOLERANCE);
        expect(letter.bottom).toBeLessThanOrEqual(candidate.stem.bottom.y + ROUNDING_TOLERANCE);
      }
    }
  });

  it('hangs the letters in intention order on the first variant, and shares the order', () => {
    const { order, style } = generate(CLM);
    expect(order).toEqual(CLM);
    expect(style).toBe('symmetric');
  });

  it('scores every candidate', () => {
    for (const candidate of generate(CLM).candidates) {
      expect(candidate.score.penalty).toBeGreaterThanOrEqual(0);
      expect(candidate.segmentCountAfter).toBeGreaterThan(0);
    }
  });

  it('accepts a single letter', () => {
    expect(generate(['K']).candidates).toHaveLength(MAX_CANDIDATE_COUNT);
  });

  it('refuses an empty list of letters', () => {
    expect(generateError([])).toEqual({ code: 'NO_LETTERS' });
  });

  it.each([
    [['J', 's'], 's', 1],
    [['J', '1'], '1', 1],
    [['JS'], 'JS', 0],
    [['É'], 'É', 0],
    [[''], '', 0],
  ])('refuses %j: %j at index %i is not a letter A–Z', (letters, letter, index) => {
    expect(generateError(letters)).toEqual({ code: 'INVALID_LETTER', letter, index });
  });

  it('refuses a repeated letter, which the Spare reduction removes', () => {
    expect(generateError(['J', 'S', 'J'])).toEqual({
      code: 'DUPLICATE_LETTER',
      letter: 'J',
      index: 2,
    });
  });

  it.each([-1, 0.5, Number.NaN])('refuses the variant %s', (variant) => {
    expect(generateError(CLM, { keepVowels: false, variant })).toEqual({
      code: 'INVALID_VARIANT',
      variant,
    });
  });
});

describe('letterOrderFor', () => {
  it('keeps the intention order on the first variant', () => {
    expect(letterOrderFor(5, 0, createRandom(1))).toEqual([0, 1, 2, 3, 4]);
  });

  it('goes through every order of a short word before repeating one', () => {
    const orders = [0, 1, 2, 3, 4, 5].map((variant) =>
      letterOrderFor(3, variant, createRandom(variant)).join(''),
    );
    expect(new Set(orders).size).toBe(6);
    expect(letterOrderFor(2, 1, createRandom(1))).toEqual([1, 0]);
  });

  it('shuffles a longer word into a permutation', () => {
    const order = letterOrderFor(7, 3, createRandom(3));
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('styleFor', () => {
  it('cycles short words through the symmetric, paired and mixed styles', () => {
    expect([0, 1, 2, 3].map((variant) => styleFor(3, variant))).toEqual([
      ...SHORT_WORD_STYLES,
      'symmetric',
    ]);
  });

  it('alternates the mixed and paired styles for long words', () => {
    expect([0, 1, 2].map((variant) => styleFor(6, variant))).toEqual([
      ...LONG_WORD_STYLES,
      'mixed',
    ]);
  });
});

describe('candidateCountFor', () => {
  it('draws the most candidates for short words', () => {
    expect(candidateCountFor(1)).toBe(MAX_CANDIDATE_COUNT);
    expect(candidateCountFor(6)).toBe(MAX_CANDIDATE_COUNT);
  });

  it('shares the budget among the letters of longer words', () => {
    expect(candidateCountFor(8)).toBe(48);
    expect(candidateCountFor(12)).toBe(32);
  });

  it('never draws fewer than the minimum, however long the word', () => {
    expect(candidateCountFor(24)).toBe(MIN_CANDIDATE_COUNT);
  });
});
