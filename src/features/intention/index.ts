/**
 * Public API of the intention domain: normalisation of the typed text into
 * letters A–Z (all methods), the single-word rule (D18) and the Spare letter
 * reduction.
 *
 * Other features import from this file only.
 */
export { normalizeIntention } from './normalize.ts';
export type { Intention, NormalizeIntentionError, NormalizeIntentionResult } from './normalize.ts';
export { checkSingleWord, MAX_INTENTION_LETTERS } from './word.ts';
export type { SingleWordError, SingleWordResult } from './word.ts';
export { reduceForSpare } from './reduce.ts';
export type { SpareReductionOptions, SpareReductionResult } from './reduce.ts';
