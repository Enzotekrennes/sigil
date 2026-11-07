/**
 * Letter → number conversion of the kamea method (decision D2).
 *
 * A letter's alphabetical rank (A = 1 … Z = 26) wraps around the N² cells of
 * the chosen square: number = ((rank − 1) mod N²) + 1. On Saturn (N² = 9) this
 * is the Pythagorean reduction. Exposes the rule identifier shown by the
 * explanation panel and the conversion functions. Does not normalise text:
 * letters arrive already reduced to A–Z.
 */

/** Identifier of the conversion rule, worded by the explanation panel. */
export const CONVERSION_RULE = 'rank-wrap';

/** Character code of `A`, so that `A` gets rank 1. */
const CODE_BEFORE_A = 'A'.charCodeAt(0) - 1;

/** A single upper-case Latin letter. */
const LATIN_LETTER = /^[A-Z]$/;

/**
 * Gives the alphabetical rank of a letter.
 *
 * @param letter - One upper-case letter A–Z.
 * @returns 1 for A … 26 for Z, or `undefined` when `letter` is not a single A–Z letter.
 */
export function letterRank(letter: string): number | undefined {
  if (!LATIN_LETTER.test(letter)) return undefined;
  return letter.charCodeAt(0) - CODE_BEFORE_A;
}

/**
 * Maps an alphabetical rank onto a square of `cellCount` cells, wrapping back
 * to 1 past the last cell.
 *
 * @param rank - Alphabetical rank, 1 … 26.
 * @param cellCount - Number of cells N² of the square, at least 1.
 * @returns The number of the square, 1 … `cellCount`.
 */
export function rankToNumber(rank: number, cellCount: number): number {
  return ((rank - 1) % cellCount) + 1;
}
