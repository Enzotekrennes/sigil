/**
 * Public API of the Spare method: the sigil builder, plus the seed derivation
 * and candidate generation it relies on.
 *
 * Other features import from this file only. Scoring and simplification
 * (`score.ts`, `simplify.ts`) are internal steps of `buildSpareSigil`.
 */
export { buildSpareSigil } from './buildSpareSigil.ts';
export type { SpareError, SpareOptions, SpareResult } from './buildSpareSigil.ts';
export { CANDIDATE_COUNT, generateSpareCandidates } from './generateSpareCandidates.ts';
export type {
  SpareCandidate,
  SpareCandidateOptions,
  SpareCandidates,
  SpareCandidatesResult,
  SpareCompositionError,
} from './generateSpareCandidates.ts';
export type { LetterPlacement, QuarterTurn } from './placement.ts';
export { spareSeed } from './seed.ts';
export type { SpareSeedInput } from './seed.ts';
