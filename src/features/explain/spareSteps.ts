/**
 * Reading helpers over the explanation steps of a Spare sigil: picks each
 * step out of `Sigil.steps`, sorts the removed letters by reason, and rounds
 * the letter sizes for display.
 *
 * Pure functions, no rendering. Recomputes nothing the Spare method already
 * produced: letters, transforms, scores and counts all come from the sigil.
 */
import type {
  ExplanationStep,
  SpareCandidateChoiceStep,
  SpareLetterPlacementsStep,
  SpareLetterReductionStep,
  SpareRemovedLetter,
  SpareSimplificationStep,
} from '../sigil/types.ts';

/** The four steps a Spare sigil carries, ready for display. */
export interface SpareSteps {
  readonly reduction: SpareLetterReductionStep;
  readonly placements: SpareLetterPlacementsStep;
  readonly choice: SpareCandidateChoiceStep;
  readonly simplification: SpareSimplificationStep;
}

/**
 * Picks the Spare steps out of a sigil's explanation.
 *
 * @param steps - `Sigil.steps` of any method.
 * @returns The four Spare steps, or `undefined` when one is missing (the
 *   sigil was not drawn by the Spare method).
 */
export function readSpareSteps(steps: readonly ExplanationStep[]): SpareSteps | undefined {
  let reduction: SpareLetterReductionStep | undefined;
  let placements: SpareLetterPlacementsStep | undefined;
  let choice: SpareCandidateChoiceStep | undefined;
  let simplification: SpareSimplificationStep | undefined;
  for (const step of steps) {
    if (step.kind === 'spare-letter-reduction') reduction = step;
    else if (step.kind === 'spare-letter-placements') placements = step;
    else if (step.kind === 'spare-candidate-choice') choice = step;
    else if (step.kind === 'spare-simplification') simplification = step;
  }
  if (
    reduction === undefined ||
    placements === undefined ||
    choice === undefined ||
    simplification === undefined
  ) {
    return undefined;
  }
  return { reduction, placements, choice, simplification };
}

/**
 * Why each letter of the intention was removed, by position.
 *
 * @param removed - Removed letters of the reduction step.
 * @returns A map from the letter's index in the normalised letters to its
 *   reason; retained letters are absent.
 */
export function removalByPosition(
  removed: readonly SpareRemovedLetter[],
): ReadonlyMap<number, SpareRemovedLetter['reason']> {
  return new Map(removed.map((entry) => [entry.position, entry.reason]));
}

/**
 * Removed letters of one reason, in intention order.
 *
 * @param removed - Removed letters of the reduction step.
 * @param reason - `duplicate` or `vowel`.
 * @returns The letters, repetitions kept (a vowel written three times is listed three times).
 */
export function lettersRemovedFor(
  removed: readonly SpareRemovedLetter[],
  reason: SpareRemovedLetter['reason'],
): string[] {
  return removed.filter((entry) => entry.reason === reason).map((entry) => entry.letter);
}

/**
 * Size of a letter relative to the largest possible one, for display.
 *
 * @param scale - `SpareLetterPlacement.scale`, 0.7–1 (`MIN_LETTER_SCALE` of the
 *   Spare placement).
 * @returns A whole percentage.
 */
export function scalePercent(scale: number): number {
  return Math.round(scale * 100);
}
