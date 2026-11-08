/**
 * Public API of the Spare method: the sigil builder, plus the seed derivation
 * and candidate generation it relies on.
 *
 * Other features import from this file only. The angular skeletons, the
 * bind-rune composition, the score and the merging (`angular.ts`,
 * `bindRune.ts`, `runeScore.ts`, `simplify.ts`) are internal steps of
 * `buildSpareSigil`; only the types the candidates refer to (`Attachment`,
 * `RuneSide`, `CapitalLetter`) are exported from them.
 *
 * Deterministic: the same letters, options and variant always give the same
 * sigil. It expects letters already normalised (see the intention feature),
 * applies the Spare reduction itself through that feature, and does not render
 * the sigil.
 *
 * @packageDocumentation
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
export type { Attachment, RuneSide } from './bindRune.ts';
export type { CapitalLetter } from './glyphs/types.ts';
export { spareSeed } from './seed.ts';
export type { SpareSeedInput } from './seed.ts';
