/**
 * Public API of the kamea (planetary magic square) method.
 *
 * Other features import from here only: the sigil builder, its result and
 * error types, the planets and their squares, and the conversion helpers and
 * cell size the explanation panel reuses.
 *
 * Deterministic and pure: the same letters on the same planet always give the
 * same sigil. It neither normalises the intention (see the intention feature)
 * nor renders the sigil (see the sigil feature).
 *
 * @packageDocumentation
 */
export { buildKameaSigil } from './buildKameaSigil.ts';
export type { KameaError, KameaResult } from './buildKameaSigil.ts';
export { CONVERSION_RULE, letterRank, rankToNumber } from './conversion.ts';
export { kameaCellSize } from './grid.ts';
export { KAMEA_SQUARES, PLANETS } from './squares.ts';
