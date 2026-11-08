/**
 * Normalisation of a typed intention into the Latin letters A–Z that every
 * sigil method works on (plan decision D5).
 *
 * Exposes `normalizeIntention` and the `Intention` model. It does not remove
 * duplicates or vowels: that reduction belongs to the Spare method only
 * (see `reduce.ts`), since the kamea method traces every letter (D3).
 */

/**
 * An intention reduced to the letters the sigil methods consume.
 */
export interface Intention {
  /** The text exactly as typed, kept only in memory for display. */
  source: string;
  /** Uppercase letters A–Z in typing order, one letter per entry, duplicates included. */
  letters: string[];
  /**
   * Characters dropped because they are neither a Latin letter nor a separator
   * (digits, symbols, emoji, letters of other scripts), as typed, each listed
   * once in order of first appearance. Whitespace and punctuation are dropped
   * silently: they separate words and carry no meaning for a sigil, so
   * reporting them would only add noise to the message shown to the user.
   */
  ignored: string[];
}

/** Business error codes returned instead of an intention. */
export type NormalizeIntentionError =
  /** The input is empty or contains only whitespace or invisible characters. */
  | 'EMPTY_INTENTION'
  /** The input has visible characters but none of them maps to a letter A–Z. */
  | 'NO_LATIN_LETTER';

/** Outcome of `normalizeIntention`: the intention, or a business error. */
export type NormalizeIntentionResult =
  | {
      ok: true;
      /** The normalised intention, with at least one letter. */
      intention: Intention;
    }
  | { ok: false; error: 'EMPTY_INTENTION' }
  | {
      ok: false;
      error: 'NO_LATIN_LETTER';
      /** The characters that could not be read as letters, as in `Intention.ignored`, to show in the message. */
      ignored: string[];
    };

/**
 * Ligatures and letters that Unicode decomposition (NFD) leaves intact but
 * that stand for several Latin letters in French and German words.
 */
const LETTER_EXPANSIONS: ReadonlyMap<string, string> = new Map([
  ['œ', 'OE'],
  ['Œ', 'OE'],
  ['æ', 'AE'],
  ['Æ', 'AE'],
  ['ß', 'SS'],
  ['ẞ', 'SS'],
]);

/** Combining marks (accents, cedilla, diaeresis) left apart by NFD. */
const COMBINING_MARKS = /\p{M}/gu;

/** A normalised grapheme made only of the letters the methods accept. */
const LATIN_LETTERS_ONLY = /^[A-Z]+$/;

/**
 * Graphemes dropped without being reported: whitespace, punctuation, and
 * invisible control or format characters (zero-width spaces, BOM).
 */
const SILENT_SEPARATOR = /^[\s\p{P}\p{Cc}\p{Cf}]+$/u;

/** Input with nothing a person would see: whitespace and invisible characters only. */
const BLANK_INPUT = /^[\s\p{Cc}\p{Cf}]*$/u;

/**
 * Splits text into user-perceived characters, so that an emoji with skin tone
 * or joiners, or a letter followed by combining accents, stays one unit.
 */
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Converts one grapheme to uppercase Latin letters: ligatures expanded,
 * accents stripped.
 *
 * @param grapheme - One user-perceived character.
 * @returns The candidate letters; not guaranteed to be A–Z (digits, emoji and
 *   other scripts come back unchanged apart from case).
 */
function toLatinLetters(grapheme: string): string {
  const expanded = Array.from(grapheme, (char) => LETTER_EXPANSIONS.get(char) ?? char).join('');

  return expanded.normalize('NFD').replace(COMBINING_MARKS, '').toUpperCase();
}

/**
 * Normalises a typed intention into Latin letters A–Z, so that the same word
 * produces the same sigil whatever its accents, case or punctuation
 * (« Sérénité » and « serenite ! » give the same letters).
 *
 * Accepts any number of words: the single-word rule (decision D18) is
 * `checkSingleWord`'s, which the caller runs as well.
 *
 * Accents are stripped (É → E), œ/æ become OE/AE and ß becomes SS. Whitespace
 * and punctuation are dropped silently; any other non-letter is dropped and
 * listed in `ignored` so the interface can tell the user.
 *
 * @param source - The intention as typed; any length, any script.
 * @returns The intention, or `EMPTY_INTENTION` when nothing visible was typed,
 *   or `NO_LATIN_LETTER` (with the ignored characters) when no letter A–Z is
 *   left. Never throws.
 */
export function normalizeIntention(source: string): NormalizeIntentionResult {
  if (BLANK_INPUT.test(source)) {
    return { ok: false, error: 'EMPTY_INTENTION' };
  }

  const letters: string[] = [];
  const ignored: string[] = [];

  for (const { segment } of graphemeSegmenter.segment(source)) {
    const normalized = toLatinLetters(segment);

    if (LATIN_LETTERS_ONLY.test(normalized)) {
      letters.push(...Array.from(normalized));
    } else if (!SILENT_SEPARATOR.test(segment) && !ignored.includes(segment)) {
      ignored.push(segment);
    }
  }

  if (letters.length === 0) {
    return { ok: false, error: 'NO_LATIN_LETTER', ignored };
  }

  return { ok: true, intention: { source, letters, ignored } };
}
