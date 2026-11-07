/**
 * Public API of the intention domain: normalisation of the typed text into
 * letters A–Z (all methods) and the Spare letter reduction.
 *
 * Other features import from this file only.
 */
export { normalizeIntention } from './normalize.ts';
export type { Intention, NormalizeIntentionError, NormalizeIntentionResult } from './normalize.ts';
export { reduceForSpare } from './reduce.ts';
export type {
  RemovalReason,
  RemovedLetter,
  SpareReductionOptions,
  SpareReductionResult,
} from './reduce.ts';
