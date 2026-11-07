/**
 * Unit tests of the Spare candidate generation: seed (D6), determinism,
 * distinct variants, every candidate inside the frame, strokes and
 * transforms traced per letter, the number of candidates per intention
 * length, and business errors on invalid input.
 */
import { describe, expect, it } from 'vitest';

import { getGlyph } from './glyphs/index.ts';
import { FRAME_MARGIN } from '../sigil/frame.ts';
import {
  MAX_CANDIDATE_COUNT,
  MIN_CANDIDATE_COUNT,
  candidateCountFor,
  generateSpareCandidates,
  spareSeed,
} from './index.ts';
import type { SpareCandidateOptions, SpareCandidates, SpareCompositionError } from './index.ts';

/** Retained letters of "Je suis calme" with vowels removed. */
const JSCLM = ['J', 'S', 'C', 'L', 'M'];

/** First variant with vowels removed, the default settings. */
const DEFAULT_OPTIONS: SpareCandidateOptions = { keepVowels: false, variant: 0 };

/** Letter sets covering a single letter, the example, and a long intention. */
const LETTER_SETS: readonly (readonly string[])[] = [
  ['W'],
  JSCLM,
  ['B', 'D', 'F', 'G', 'H', 'K', 'N', 'P', 'Q', 'R', 'T', 'V', 'X', 'Y', 'Z'],
];

/** Tolerance on the drawing extent, above the 4-decimal rounding of coordinates. */
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
  it('draws as many candidates as the scoring budget allows, from the D6 seed', () => {
    const { seed, candidates } = generate(JSCLM);

    expect(seed).toBe(spareSeed({ letters: JSCLM, ...DEFAULT_OPTIONS }));
    expect(candidates).toHaveLength(candidateCountFor(JSCLM.length));
  });

  it('gives deeply equal results for the same letters and settings', () => {
    expect(generate(JSCLM)).toEqual(generate([...JSCLM]));
    expect(generate(JSCLM, { keepVowels: true, variant: 7 })).toEqual(
      generate(JSCLM, { keepVowels: true, variant: 7 }),
    );
  });

  it('gives each variant its own candidates', () => {
    const variants = Array.from({ length: 10 }, (_, variant) =>
      generate(JSCLM, { keepVowels: false, variant }),
    );
    const firsts = new Set(variants.map((variant) => JSON.stringify(variant.candidates[0])));

    expect(new Set(variants.map((variant) => variant.seed)).size).toBe(10);
    expect(firsts.size).toBe(10);
  });

  it('draws candidates that differ from one another', () => {
    const { candidates } = generate(JSCLM);
    const shapes = new Set(candidates.map((candidate) => JSON.stringify(candidate.strokes)));
    expect(shapes.size).toBe(candidates.length);
  });

  it.each(LETTER_SETS.map((letters) => [letters.join('')]))(
    'keeps every point of every candidate of %s inside the frame margin',
    (word) => {
      for (let variant = 0; variant < 5; variant += 1) {
        const { candidates } = generate(word.split(''), { keepVowels: false, variant });
        for (const candidate of candidates) {
          const points = candidate.strokes.flat();
          const xs = points.map((point) => point.x);
          const ys = points.map((point) => point.y);
          for (const value of [...xs, ...ys]) {
            expect(value).toBeGreaterThanOrEqual(FRAME_MARGIN);
            expect(value).toBeLessThanOrEqual(100 - FRAME_MARGIN);
          }
          // Fitted, not merely contained: the larger side spans the drawing area.
          const extent = Math.max(
            Math.max(...xs) - Math.min(...xs),
            Math.max(...ys) - Math.min(...ys),
          );
          expect(extent).toBeGreaterThan(100 - 2 * FRAME_MARGIN - ROUNDING_TOLERANCE);
        }
      }
    },
  );

  it('keeps as many strokes as the glyphs have, each with its letter', () => {
    const expectedOwners = JSCLM.flatMap((letter, index) =>
      getGlyph(letter).strokes.map(() => index),
    );

    for (const candidate of generate(JSCLM).candidates) {
      expect(candidate.strokes).toHaveLength(expectedOwners.length);
      expect(candidate.strokeLetters).toEqual(expectedOwners);
      for (const stroke of candidate.strokes) {
        expect(stroke.length).toBeGreaterThanOrEqual(2);
        stroke.slice(1).forEach((point, index) => {
          expect(point).not.toEqual(stroke[index]);
        });
      }
    }
  });

  it('traces the transforms of each letter, in input order', () => {
    for (const candidate of generate(JSCLM).candidates) {
      expect(candidate.placements.map((placement) => placement.letter)).toEqual(JSCLM);
      for (const placement of candidate.placements) {
        expect(typeof placement.mirrored).toBe('boolean');
        expect([0, 90, 180, 270]).toContain(placement.rotation);
        expect(placement.scale).toBeGreaterThan(0);
      }
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
    expect(generateError(JSCLM, { keepVowels: false, variant })).toEqual({
      code: 'INVALID_VARIANT',
      variant,
    });
  });
});

describe('candidateCountFor', () => {
  it('draws the most candidates for short intentions, which need them to hide every letter', () => {
    expect(candidateCountFor(1)).toBe(MAX_CANDIDATE_COUNT);
    expect(candidateCountFor(5)).toBe(MAX_CANDIDATE_COUNT);
  });

  it('shares the scoring budget among the letters of longer intentions', () => {
    expect(candidateCountFor(6)).toBe(80);
    expect(candidateCountFor(10)).toBe(48);
  });

  it('never draws fewer than the minimum, however long the intention', () => {
    expect(candidateCountFor(15)).toBe(32);
    expect(candidateCountFor(26)).toBe(MIN_CANDIDATE_COUNT);
  });
});
