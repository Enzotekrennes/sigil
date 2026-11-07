/**
 * Access to the letter skeletons of the Spare method: one Hershey Roman
 * Simplex capital per letter A–Z (plan decision D7).
 *
 * Exposes `getGlyph` and `isCapitalLetter`. Returns glyphs in their own frame
 * (see `types.ts`); placing, transforming and scaling them into the sigil
 * frame belongs to the composition.
 */
import { ROMAN_SIMPLEX_CAPITALS } from './hersheyRomanSimplex.ts';
import type { CapitalLetter, Glyph } from './types.ts';

/** A single upper-case Latin letter. */
const CAPITAL_LETTER = /^[A-Z]$/;

/**
 * Tells whether a string is one of the 26 letters that have a glyph.
 *
 * @param letter - Any string.
 * @returns `true` for a single upper-case letter A–Z.
 */
export function isCapitalLetter(letter: string): letter is CapitalLetter {
  return CAPITAL_LETTER.test(letter);
}

/**
 * Gives the single-stroke skeleton of a letter.
 *
 * @param letter - One upper-case letter A–Z, as produced by the intention
 *   normalisation.
 * @returns The glyph's strokes, advance and bounding box, in the glyph frame
 *   (Hershey units, x from the left side bearing, y downwards from the
 *   baseline). The returned data is shared and read-only.
 * @throws {RangeError} When `letter` is not a single upper-case letter A–Z.
 */
export function getGlyph(letter: string): Glyph {
  if (!isCapitalLetter(letter)) {
    throw new RangeError(`No glyph for "${letter}": expected one upper-case letter A–Z.`);
  }
  const { strokes, advance, bounds } = ROMAN_SIMPLEX_CAPITALS[letter];
  return { strokes, advance, bounds };
}
