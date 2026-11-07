/**
 * Public API of the Spare letter skeletons: Hershey Roman Simplex capitals
 * A–Z as single-stroke polylines.
 *
 * The rest of the Spare method imports from this file only. The conversion
 * tooling (`hersheyConversion.ts`) is not exported: it only serves the
 * generation script and its tests.
 */
export { getGlyph, isCapitalLetter } from './getGlyph.ts';
export type { CapitalLetter, Glyph } from './types.ts';
