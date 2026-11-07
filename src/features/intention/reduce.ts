/**
 * Letter reduction of the Spare method (plan decision D4): duplicates are
 * always removed, vowels by default.
 *
 * Exposes `reduceForSpare` and the trace of removed letters that the
 * explanation panel displays. The kamea method does not use it: it traces
 * every normalised letter (D3).
 */

/** Why a letter was removed from the intention. */
export type RemovalReason =
  /** The letter already appeared earlier in the intention. */
  | 'duplicate'
  /** The letter is a vowel and vowels were not kept. */
  | 'vowel';

/** One letter removed by the reduction, for the explanation panel. */
export interface RemovedLetter {
  /** The removed letter, A–Z. */
  letter: string;
  /** Zero-based index of the letter in the normalised letters given as input. */
  position: number;
  /** Rule that removed it. */
  reason: RemovalReason;
}

/** Settings of the Spare reduction. */
export interface SpareReductionOptions {
  /** Keep the vowels and remove only duplicates; for intentions with few consonants. */
  keepVowels: boolean;
}

/** Outcome of `reduceForSpare`: the retained letters, or a business error. */
export type SpareReductionResult =
  | {
      ok: true;
      /** Retained letters, in their order of first appearance. */
      kept: string[];
      /** Removed letters in input order, each with the rule that removed it. */
      removed: RemovedLetter[];
    }
  | {
      ok: false;
      error: 'NO_LETTER_LEFT';
      /**
       * True when vowels were removed and keeping them would leave at least
       * one letter, so the interface can offer the `keepVowels` option.
       */
      suggestKeepVowels: boolean;
    };

/**
 * Vowels removed by the Spare method. Y is deliberately absent and kept as a
 * consonant: the method is usually stated with the five vowels A E I O U, Y is
 * a consonant or semi-vowel in many words (« yeux », « yoga », "you"), and
 * keeping it leaves one more letter to draw for short intentions.
 */
const SPARE_VOWELS: ReadonlySet<string> = new Set(['A', 'E', 'I', 'O', 'U']);

/**
 * Reduces normalised letters with the Spare method: every repeated letter is
 * removed (the first occurrence stays, order is preserved), then the vowels
 * unless `keepVowels` is set. A repeated vowel is traced as a duplicate, since
 * duplicates are removed first.
 *
 * @param letters - Uppercase letters A–Z, as produced by `normalizeIntention`.
 * @param options - Whether vowels are kept.
 * @returns The retained letters and the trace of removed ones, or
 *   `NO_LETTER_LEFT` when nothing remains (with `suggestKeepVowels` set when
 *   keeping vowels would help). Never throws.
 */
export function reduceForSpare(
  letters: readonly string[],
  options: SpareReductionOptions,
): SpareReductionResult {
  const seen = new Set<string>();
  const kept: string[] = [];
  const removed: RemovedLetter[] = [];

  letters.forEach((letter, position) => {
    if (seen.has(letter)) {
      removed.push({ letter, position, reason: 'duplicate' });
      return;
    }
    seen.add(letter);

    if (!options.keepVowels && SPARE_VOWELS.has(letter)) {
      removed.push({ letter, position, reason: 'vowel' });
      return;
    }
    kept.push(letter);
  });

  if (kept.length === 0) {
    const suggestKeepVowels = removed.some((removal) => removal.reason === 'vowel');
    return { ok: false, error: 'NO_LETTER_LEFT', suggestKeepVowels };
  }

  return { ok: true, kept, removed };
}
