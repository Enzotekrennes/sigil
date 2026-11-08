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
 * Runs of whitespace of any kind (spaces, no-break spaces, tabs, line
 * breaks): the only candidates for a word boundary. Apostrophes, hyphens and
 * other punctuation are not in it, so « aujourd'hui », « peut-être » and
 * « je.suis.calme » stay one word; `normalizeIntention` then drops the
 * punctuation silently.
 */
const WHITESPACE_RUN = /\s+/u;

/** Business error codes of the single-word rule. */
export type SingleWordError =
  /** Whitespace separates two parts that both hold Latin letters. */
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
 * Whether a whitespace-free part of the text gives at least one letter A–Z.
 *
 * @param part - Text between two whitespace runs.
 * @returns True for a word ("Calme", "été"), false for punctuation, digits,
 *   symbols or another script only ("!", "«", "2026", "😀").
 */
function holdsLatinLetter(part: string): boolean {
  return normalizeIntention(part).ok;
}

/**
 * Checks that a typed intention is a single word of at most
 * `MAX_INTENTION_LETTERS` letters, so that the sigil stays readable.
 *
 * Whitespace separates two words only when Latin letters stand on both sides
 * of it: parts without any letter A–Z (punctuation, digits, symbols, other
 * scripts) are not words. So the French typography « Calme ! », « « Calme » »
 * and « Calme 2026 » are one word (the « 2026 », like the « ! », is then
 * dropped by the normalisation, digits being reported as ignored), while
 * « Je suis calme » is three. Apostrophes (' ’), hyphens and any punctuation
 * without whitespace keep one word (« aujourd'hui », « je.suis.calme »).
 * Letters are counted after normalisation (accents stripped, ligatures
 * expanded, non-letters dropped).
 *
 * @param source - The intention as typed; any text.
 * @returns `{ ok: true }` for one word within the limit, including an empty
 *   or letterless text (those are `normalizeIntention`'s errors);
 *   `MULTIPLE_WORDS` as soon as two whitespace-separated parts hold letters,
 *   whatever their length; otherwise `TOO_LONG` with the letter count and the
 *   limit. Never throws.
 */
export function checkSingleWord(source: string): SingleWordResult {
  const words = source.trim().split(WHITESPACE_RUN).filter(holdsLatinLetter);
  if (words.length > 1) {
    return { ok: false, error: 'MULTIPLE_WORDS' };
  }

  const normalized = normalizeIntention(source);
  const letterCount = normalized.ok ? normalized.intention.letters.length : 0;
  if (letterCount > MAX_INTENTION_LETTERS) {
    return { ok: false, error: 'TOO_LONG', letterCount, maxLetters: MAX_INTENTION_LETTERS };
  }

  return { ok: true };
}
