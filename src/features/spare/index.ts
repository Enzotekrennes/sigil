/**
 * Public API of the Spare method: the sigil builder, plus the seed derivation
 * and candidate generation it relies on.
 *
 * Other features import from this file only. The angular skeletons, the
 * bind-rune composition, the score and the merging (`angular.ts`,
 * `bindRune.ts`, `runeScore.ts`, `simplify.ts`) are internal steps of
 * `buildSpareSigil`.
 */
export { buildSpareSigil } from './buildSpareSigil.ts';
export type { SpareError, SpareOptions, SpareResult } from './buildSpareSigil.ts';
export {
  MAX_CANDIDATE_COUNT,
  MIN_CANDIDATE_COUNT,
  candidateCountFor,
  generateSpareCandidates,
} from './generateSpareCandidates.ts';
export type {
  SpareCandidate,
  SpareCandidateLetter,
  SpareCandidateOptions,
  SpareCandidates,
  SpareCandidatesResult,
  SpareCompositionError,
} from './generateSpareCandidates.ts';
export { spareSeed } from './seed.ts';
export type { SpareSeedInput } from './seed.ts';
