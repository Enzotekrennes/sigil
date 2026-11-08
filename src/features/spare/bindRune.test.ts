/**
 * Unit tests of the bind-rune composition (decision D19): how each letter
 * can hook onto the stem, the stem drawn first and covering every letter,
 * every letter touching or crossing it, runes taller than wide, the three
 * layout styles (doubled letters mirrored across the stem, paired letters,
 * mixed), and determinism for a given generator.
 */
import { describe, expect, it } from 'vitest';

import { createRandom } from '../../lib/random.ts';
import type { Point, SpareRuneStyle } from '../sigil/types.ts';
import { MIN_ASPECT_RATIO, attachmentsOf, composeBindRune } from './bindRune.ts';
import type { RuneComposition } from './bindRune.ts';
import type { CapitalLetter } from './glyphs/index.ts';

/** Letter sets: a single letter, a short word, a long word with letters of every kind. */
const LETTER_SETS: readonly (readonly CapitalLetter[])[] = [
  ['R'],
  ['C', 'L', 'M'],
  ['S', 'T', 'R', 'N', 'G', 'H'],
  ['P', 'R', 'T', 'C', 'N', 'O', 'X', 'V', 'Y'],
];

/** Layout styles. */
const STYLES: readonly SpareRuneStyle[] = ['symmetric', 'paired', 'mixed'];

/** Seeds drawn per letter set and style. */
const SEEDS = [1, 2, 3, 42, 2026];

/** Distance under which a point counts as on the stem, in rune units. */
const ON_STEM = 1e-9;

/**
 * Strokes of one letter of a rune.
 *
 * @param rune - A composed rune.
 * @param letter - Index of the letter.
 * @returns Its strokes, its double's included.
 */
function strokesOf(rune: RuneComposition, letter: number): (readonly Point[])[] {
  return rune.strokes.filter((_, stroke) => rune.strokeLetters[stroke] === letter);
}

/**
 * Whether some strokes touch or cross the vertical x = 0.
 *
 * @param strokes - Strokes in rune units.
 * @returns True when a point lies on it or a segment has ends on both sides.
 */
function touchesStem(strokes: readonly (readonly Point[])[]): boolean {
  return strokes.some((stroke) =>
    stroke.some((point, index) => {
      if (Math.abs(point.x) <= ON_STEM) return true;
      const previous = stroke[index - 1];
      return previous !== undefined && Math.sign(previous.x) !== Math.sign(point.x);
    }),
  );
}

/**
 * Composes every letter set in every style with every seed.
 *
 * @returns The runes with their style.
 */
function everyRune(): { rune: RuneComposition; style: SpareRuneStyle }[] {
  return LETTER_SETS.flatMap((letters) =>
    STYLES.flatMap((style) =>
      SEEDS.map((seed) => ({ rune: composeBindRune(letters, createRandom(seed), style), style })),
    ),
  );
}

describe('attachmentsOf', () => {
  it('hooks a letter by its vertical stroke when it has one', () => {
    expect(attachmentsOf('R')).toEqual([{ attachment: 'stem', anchorX: 4 }]);
    expect(attachmentsOf('T')).toEqual([{ attachment: 'stem', anchorX: 8 }]);
    expect(attachmentsOf('J')).toEqual([{ attachment: 'stem', anchorX: 12 }]);
  });

  it('offers each vertical of a letter that has two, from left to right', () => {
    expect(attachmentsOf('H')).toEqual([
      { attachment: 'stem', anchorX: 4 },
      { attachment: 'stem', anchorX: 18 },
    ]);
  });

  it('lets the half stem of Y lie on the stem, so that it forks off it', () => {
    expect(attachmentsOf('Y')).toEqual([{ attachment: 'stem', anchorX: 9 }]);
  });

  it('centres a letter without a vertical, or hangs it by a single corner', () => {
    expect(attachmentsOf('O')).toEqual([
      { attachment: 'centre', anchorX: 11 },
      { attachment: 'tip', anchorX: 3 },
      { attachment: 'tip', anchorX: 19 },
    ]);
    expect(attachmentsOf('C')).toEqual([
      { attachment: 'centre', anchorX: 10.5 },
      { attachment: 'tip', anchorX: 3 },
    ]);
    // X ends in two corners on each side: it can only be centred.
    expect(attachmentsOf('X')).toEqual([{ attachment: 'centre', anchorX: 10 }]);
  });
});

describe('composeBindRune', () => {
  it('draws the stem first, on x = 0, covering every letter', () => {
    for (const { rune } of everyRune()) {
      const [stem] = rune.strokes;
      expect(stem).toEqual([
        { x: 0, y: rune.stem.top },
        { x: 0, y: rune.stem.bottom },
      ]);
      expect(rune.strokeLetters[0]).toBe(-1);
      const ys = rune.strokes.flat().map((point) => point.y);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(rune.stem.top);
      expect(Math.max(...ys)).toBeLessThanOrEqual(rune.stem.bottom);
    }
  });

  it('hooks every letter onto the stem', () => {
    for (const { rune } of everyRune()) {
      rune.letters.forEach((_, letter) => {
        expect(touchesStem(strokesOf(rune, letter))).toBe(true);
      });
    }
  });

  it('makes runes taller than wide', () => {
    for (const { rune } of everyRune()) {
      const xs = rune.strokes.flat().map((point) => point.x);
      const width = Math.max(...xs) - Math.min(...xs);
      expect(rune.stem.bottom - rune.stem.top).toBeGreaterThanOrEqual(
        MIN_ASPECT_RATIO * width - 1e-9,
      );
    }
  });

  it('reports the letters in the order given, with their side of the stem', () => {
    for (const { rune } of everyRune()) {
      rune.letters.forEach((letter, index) => {
        const xs = strokesOf(rune, index)
          .flat()
          .map((point) => point.x);
        if (letter.side === 'left') expect(Math.max(...xs)).toBeLessThanOrEqual(ON_STEM);
        if (letter.side === 'right') expect(Math.min(...xs)).toBeGreaterThanOrEqual(-ON_STEM);
        if (letter.side === 'both') {
          expect(Math.min(...xs)).toBeLessThan(0);
          expect(Math.max(...xs)).toBeGreaterThan(0);
        }
      });
    }
  });

  it('doubles every one-sided letter in the symmetric style, as its mirror image', () => {
    for (const { rune, style } of everyRune()) {
      if (style !== 'symmetric') continue;
      rune.letters.forEach((letter, index) => {
        expect(letter.side === 'both').toBe(true);
        if (!letter.doubled) return;
        const strokes = strokesOf(rune, index);
        const half = strokes.length / 2;
        strokes.slice(0, half).forEach((stroke, strokeIndex) => {
          expect(strokes[half + strokeIndex]).toEqual(
            stroke.map((point) => ({ x: -point.x + 0, y: point.y })),
          );
        });
      });
    }
  });

  it('never doubles a letter in the paired style', () => {
    for (const { rune, style } of everyRune()) {
      if (style === 'paired') expect(rune.letters.some((letter) => letter.doubled)).toBe(false);
    }
  });

  it('keeps the first one-sided letter single in the mixed style', () => {
    for (const { rune, style } of everyRune()) {
      if (style !== 'mixed') continue;
      const first = rune.letters.find((letter) => letter.side !== 'both' || letter.doubled);
      if (first !== undefined) expect(first.doubled).toBe(false);
    }
  });

  it('gives the same rune for the same generator state', () => {
    const letters: CapitalLetter[] = ['S', 'T', 'R', 'N', 'G', 'H'];
    expect(composeBindRune(letters, createRandom(7), 'mixed')).toEqual(
      composeBindRune(letters, createRandom(7), 'mixed'),
    );
    expect(composeBindRune(letters, createRandom(8), 'mixed')).not.toEqual(
      composeBindRune(letters, createRandom(7), 'mixed'),
    );
  });
});
