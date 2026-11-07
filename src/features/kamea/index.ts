/**
 * Public API of the kamea (planetary magic square) method.
 *
 * Other features import from here only: the sigil builder, its result and
 * error types, the planets and their squares, and the conversion helpers the
 * explanation panel may reuse.
 */
export { buildKameaSigil } from './buildKameaSigil.ts';
export type { KameaError, KameaResult } from './buildKameaSigil.ts';
export { CONVERSION_RULE, letterRank, rankToNumber } from './conversion.ts';
export { KAMEA_SQUARES, PLANETS } from './squares.ts';
