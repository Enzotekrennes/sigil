/**
 * Single-word rule of the intention (plan decision D18): both methods trace
 * one word only, because beyond one word the sigil becomes unreadable.
 *
 * Exposes `checkSingleWord`, `MAX_INTENTION_LETTERS` and their result types.
 * It does not normalise the text nor reject texts without letters: that is
 * `normalizeIntention` (which still accepts sentences, on purpose), and the
 * caller decides in which order the two checks run.
 */
import { normalizeIntention } from './normalize.ts';

/**
 * Most letters a one-word intention may give once normalised. 24 covers the
 * long words people actually choose (« constitutionnellement » has 21) while
 * keeping the kamea path and the Spare rune readable at tattoo sizes.
 */
export const MAX_INTENTION_LETTERS = 24;

/**
 * Whitespace of any kind (spaces, no-break spaces, tabs, line breaks): what
 * separates two words. Apostrophes and hyphens are not in it, so
 * « aujourd'hui » and « peut-être » stay one word; `normalizeIntention`
 * then drops them silently like any punctuation.
 */
const WORD_SEPARATOR = /\s/u;

/** Business error codes of the single-word rule. */
export type SingleWordError =
  /** The trimmed text still contains whitespace: it is several words. */
  | 'MULTIPLE_WORDS'
  /** The word gives more than `MAX_INTENTION_LETTERS` letters A–Z. */
  | 'TOO_LONG';

/** Outcome of `checkSingleWord`. */
export type SingleWordResult =
  | { ok: true }
  | { ok: false; error: 'MULTIPLE_WORDS' }
  | {
      ok: false;
      error: 'TOO_LONG';
      /** Letters A–Z the word gives once normalised (ß counts as SS, œ as OE). */
      letterCount: number;
      /** The limit exceeded, `MAX_INTENTION_LETTERS`. */
      maxLetters: number;
    };

/**
 * Checks that a typed intention is a single word of at most
 * `MAX_INTENTION_LETTERS` letters, so that the sigil stays readable.
 *
 * Leading and trailing whitespace is ignored. Inside the word, any whitespace
 * (space, no-break space, tab, line break) makes it several words;
 * apostrophes (' ’) and hyphens are allowed. Letters are counted after
 * normalisation (accents stripped, ligatures expanded, non-letters dropped).
 *
 * @param source - The intention as typed; any text.
 * @returns `{ ok: true }` for one word within the limit, including an empty
 *   or letterless text (those are `normalizeIntention`'s errors);
 *   `MULTIPLE_WORDS` as soon as whitespace separates two parts, whatever their
 *   length; otherwise `TOO_LONG` with the letter count and the limit.
 *   Never throws.
 */
export function checkSingleWord(source: string): SingleWordResult {
  if (WORD_SEPARATOR.test(source.trim())) {
    return { ok: false, error: 'MULTIPLE_WORDS' };
  }

  const normalized = normalizeIntention(source);
  const letterCount = normalized.ok ? normalized.intention.letters.length : 0;
  if (letterCount > MAX_INTENTION_LETTERS) {
    return { ok: false, error: 'TOO_LONG', letterCount, maxLetters: MAX_INTENTION_LETTERS };
  }

  return { ok: true };
}
