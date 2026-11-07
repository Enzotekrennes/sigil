/**
 * Public API of the Spare method: seed derivation and generation of the
 * candidate compositions of the letters' skeletons.
 *
 * Other features import from this file only. Scoring, stroke merging,
 * simplification and the final `Sigil` builder are not part of it yet.
 */
export {
  CANDIDATE_COUNT,
  FRAME_MARGIN,
  generateSpareCandidates,
} from './generateSpareCandidates.ts';
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
