/**
 * Reading helpers over the explanation steps of a Spare sigil: picks each
 * step out of `Sigil.steps`, sorts the removed letters by reason, and puts
 * the letters hooked onto the stem in their order from the top of the stem.
 *
 * Pure functions, no rendering. Recomputes nothing the Spare method already
 * produced: letters, skeletons, attachments, scores and counts all come from
 * the sigil.
 */
import type {
  ExplanationStep,
  Point,
  SpareAngularSkeletonsStep,
  SpareCandidateChoiceStep,
  SpareLetterReductionStep,
  SpareRemovedLetter,
  SpareSimplificationStep,
  SpareStemAttachment,
  SpareStemAttachmentsStep,
} from '../sigil/types.ts';

/** The five steps a Spare sigil carries, ready for display. */
export interface SpareSteps {
  readonly reduction: SpareLetterReductionStep;
  readonly skeletons: SpareAngularSkeletonsStep;
  readonly attachments: SpareStemAttachmentsStep;
  readonly choice: SpareCandidateChoiceStep;
  readonly simplification: SpareSimplificationStep;
}

/**
 * Picks the Spare steps out of a sigil's explanation.
 *
 * @param steps - `Sigil.steps` of any method.
 * @returns The five Spare steps, or `undefined` when one is missing (the
 *   sigil was not drawn by the Spare method).
 */
export function readSpareSteps(steps: readonly ExplanationStep[]): SpareSteps | undefined {
  let reduction: SpareLetterReductionStep | undefined;
  let skeletons: SpareAngularSkeletonsStep | undefined;
  let attachments: SpareStemAttachmentsStep | undefined;
  let choice: SpareCandidateChoiceStep | undefined;
  let simplification: SpareSimplificationStep | undefined;
  for (const step of steps) {
    if (step.kind === 'spare-letter-reduction') reduction = step;
    else if (step.kind === 'spare-angular-skeletons') skeletons = step;
    else if (step.kind === 'spare-stem-attachments') attachments = step;
    else if (step.kind === 'spare-candidate-choice') choice = step;
    else if (step.kind === 'spare-simplification') simplification = step;
  }
  if (
    reduction === undefined ||
    skeletons === undefined ||
    attachments === undefined ||
    choice === undefined ||
    simplification === undefined
  ) {
    return undefined;
  }
  return { reduction, skeletons, attachments, choice, simplification };
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
 * The hooked letters in the order the variant hangs them on the stem.
 *
 * @param step - Attachments step; its letters are distinct (the reduction
 *   removed the duplicates), so a letter names one attachment.
 * @returns The attachments from the top of the stem to the bottom; a letter of
 *   `order` without an attachment is skipped.
 */
export function attachmentsFromTop(step: SpareStemAttachmentsStep): SpareStemAttachment[] {
  const byLetter = new Map(step.letters.map((attachment) => [attachment.letter, attachment]));
  return step.order.flatMap((letter) => {
    const attachment = byLetter.get(letter);
    return attachment === undefined ? [] : [attachment];
  });
}

/**
 * The stem as a stroke, for drawing it.
 *
 * @param step - Attachments step.
 * @returns The vertical segment from the top of the stem to its bottom.
 */
export function stemStroke(step: SpareStemAttachmentsStep): readonly Point[] {
  return [step.stem.top, step.stem.bottom];
}
