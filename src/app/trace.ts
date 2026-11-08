/**
 * Chains the business steps behind the "Trace" button: normalisation of the
 * typed intention, the single-word rule (decision D18), then the sigil of the chosen method (kamea or Spare), and
 * turns their errors into the message shown under the field.
 *
 * Exposes `traceKamea`, `traceSpare`, their result and error types, and
 * `traceErrorMessage`. Pure: holds no state, writes nothing anywhere (the
 * intention stays in memory). The rules themselves live in
 * `features/intention`, `features/kamea` and `features/spare`.
 */
import { checkSingleWord, normalizeIntention } from '../features/intention/index.ts';
import type { Intention } from '../features/intention/index.ts';
import { buildKameaSigil } from '../features/kamea/index.ts';
import type { KameaError } from '../features/kamea/index.ts';
import type { Planet, Sigil } from '../features/sigil/types.ts';
import { buildSpareSigil } from '../features/spare/index.ts';
import type { SpareError, SpareOptions } from '../features/spare/index.ts';
import type { AppStrings } from './strings.fr.ts';

/** Why the typed text cannot be traced, whatever the method. */
type IntentionError =
  | { readonly code: 'EMPTY_INTENTION' }
  | { readonly code: 'NO_LATIN_LETTER'; readonly ignored: readonly string[] }
  | { readonly code: 'MULTIPLE_WORDS' }
  | { readonly code: 'TOO_LONG'; readonly letterCount: number; readonly maxLetters: number };

/** Why nothing could be traced, from any step of either method. */
export type TraceError = IntentionError | (KameaError & { readonly planet: Planet }) | SpareError;

/** A kamea sigil with what the screen and its panel need. */
export interface KameaTrace {
  readonly method: 'kamea';
  readonly sigil: Sigil;
  readonly planet: Planet;
  /** Number of letters traced. */
  readonly letterCount: number;
  /** Characters dropped by the normalisation, to tell the user. */
  readonly ignored: readonly string[];
}

/** A Spare sigil with what the screen and its panel need. */
export interface SpareTrace {
  readonly method: 'spare';
  readonly sigil: Sigil;
  /** Variant number, 0 for the first sigil of these letters and options. */
  readonly variant: number;
  /** Number of letters left after the reduction, the letters composed. */
  readonly keptCount: number;
  /** Characters dropped by the normalisation, to tell the user. */
  readonly ignored: readonly string[];
}

/** A sigil traced by either method, discriminated by `method`. */
export type Trace = KameaTrace | SpareTrace;

/** Outcome of a trace request. */
export type TraceResult<T extends Trace = Trace> =
  ({ readonly ok: true } & T) | { readonly ok: false; readonly error: TraceError };

/**
 * Normalises the intention, checks it is a single word, and draws its kamea
 * sigil on the planet's square.
 *
 * @param source - The intention as typed; any text.
 * @param planet - Square to draw on.
 * @returns The sigil with what the panel needs, or the first business error
 *   met. Never throws. Same arguments, same sigil (deep equality).
 */
export function traceKamea(source: string, planet: Planet): TraceResult<KameaTrace> {
  const read = readIntention(source);
  if (!read.ok) return read;

  const { letters, ignored } = read.intention;
  const built = buildKameaSigil(letters, planet);
  if (!built.ok) return { ok: false, error: { ...built.error, planet } };

  return {
    ok: true,
    method: 'kamea',
    sigil: built.data,
    planet,
    letterCount: letters.length,
    ignored,
  };
}

/**
 * Normalises the intention, checks it is a single word, and draws its Spare
 * sigil.
 *
 * @param source - The intention as typed; any text.
 * @param options - Vowel setting (decision D4) and variant number (integer ≥ 0).
 * @returns The sigil with what the panel needs, or the first business error
 *   met (`NO_LETTER_LEFT` tells whether keeping the vowels would help).
 *   Never throws. Same arguments, same sigil (deep equality); texts that
 *   normalise to the same letters give the same sigil (decision D6).
 */
export function traceSpare(source: string, options: SpareOptions): TraceResult<SpareTrace> {
  const read = readIntention(source);
  if (!read.ok) return read;

  const { letters, ignored } = read.intention;
  const built = buildSpareSigil(letters, options);
  if (!built.ok) return { ok: false, error: built.error };

  const reduction = built.data.steps.find((step) => step.kind === 'spare-letter-reduction');
  return {
    ok: true,
    method: 'spare',
    sigil: built.data,
    variant: options.variant,
    keptCount: reduction?.kept.length ?? 0,
    ignored,
  };
}

/**
 * Turns the typed text into the intention both methods trace, or the first
 * reason it cannot be traced. The normalisation runs first, so a text with no
 * letter at all (« 123 ! ») is told so rather than asked to be one word.
 *
 * @param source - The intention as typed; any text.
 * @returns The normalised intention, or `EMPTY_INTENTION`, `NO_LATIN_LETTER`
 *   (with the characters dropped), `MULTIPLE_WORDS` or `TOO_LONG` (with the
 *   letter count and the limit), in that order of precedence.
 */
function readIntention(
  source: string,
): { ok: true; intention: Intention } | { ok: false; error: IntentionError } {
  const normalized = normalizeIntention(source);
  if (!normalized.ok) {
    return normalized.error === 'EMPTY_INTENTION'
      ? { ok: false, error: { code: 'EMPTY_INTENTION' } }
      : { ok: false, error: { code: 'NO_LATIN_LETTER', ignored: normalized.ignored } };
  }

  const word = checkSingleWord(source);
  if (!word.ok) {
    return word.error === 'MULTIPLE_WORDS'
      ? { ok: false, error: { code: 'MULTIPLE_WORDS' } }
      : {
          ok: false,
          error: { code: 'TOO_LONG', letterCount: word.letterCount, maxLetters: word.maxLetters },
        };
  }

  return { ok: true, intention: normalized.intention };
}

/**
 * Words a trace error for the user: what went wrong and what to do.
 *
 * @param error - Error returned by `traceKamea` or `traceSpare`.
 * @param strings - Interface texts in the current language.
 * @returns The message shown under the intention field.
 */
export function traceErrorMessage(error: TraceError, strings: AppStrings): string {
  switch (error.code) {
    case 'EMPTY_INTENTION':
      return strings.errors.empty;
    case 'NO_LATIN_LETTER':
      return strings.errors.noLatinLetter(error.ignored);
    case 'MULTIPLE_WORDS':
      return strings.errors.multipleWords;
    case 'TOO_LONG':
      return strings.errors.tooLong(error.letterCount, error.maxLetters);
    case 'TOO_FEW_LETTERS':
      return strings.errors.tooFewLetters;
    case 'SINGLE_CELL':
      return strings.errors.singleCell(error.number, error.planet);
    case 'NO_LETTER_LEFT':
      return error.suggestKeepVowels ? strings.errors.onlyVowels : strings.errors.noLetterLeft;
    // The normalisation and the reduction rule these out; they mean a bug, not a user mistake.
    case 'INVALID_LETTER':
    case 'NO_LETTERS':
    case 'DUPLICATE_LETTER':
    case 'INVALID_VARIANT':
      return strings.errors.invalidLetter;
  }
}
