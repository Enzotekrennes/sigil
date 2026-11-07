/**
 * Chains the two business steps behind the "Trace" button for the kamea
 * method: normalisation of the typed intention, then the kamea sigil, and
 * turns their errors into the message shown under the field.
 *
 * Exposes `traceKamea`, its result type, and `traceErrorMessage`. Pure:
 * holds no state, writes nothing anywhere (the intention stays in memory).
 * The rules themselves live in `features/intention` and `features/kamea`.
 */
import { normalizeIntention } from '../features/intention/index.ts';
import { buildKameaSigil } from '../features/kamea/index.ts';
import type { KameaError } from '../features/kamea/index.ts';
import type { Planet, Sigil } from '../features/sigil/types.ts';
import type { AppStrings } from './strings.fr.ts';

/** Why nothing could be traced, from either step. */
export type TraceError =
  | { readonly code: 'EMPTY_INTENTION' }
  | { readonly code: 'NO_LATIN_LETTER'; readonly ignored: readonly string[] }
  | (KameaError & { readonly planet: Planet });

/** Outcome of a trace request. */
export type TraceResult =
  | {
      readonly ok: true;
      readonly sigil: Sigil;
      readonly planet: Planet;
      /** Number of letters traced. */
      readonly letterCount: number;
      /** Characters dropped by the normalisation, to tell the user. */
      readonly ignored: readonly string[];
    }
  | { readonly ok: false; readonly error: TraceError };

/**
 * Normalises the intention and draws its kamea sigil on the planet's square.
 *
 * @param source - The intention as typed; any text.
 * @param planet - Square to draw on.
 * @returns The sigil with what the panel needs, or the first business error
 *   met. Never throws. Same arguments, same sigil (deep equality).
 */
export function traceKamea(source: string, planet: Planet): TraceResult {
  const normalized = normalizeIntention(source);
  if (!normalized.ok) {
    return normalized.error === 'EMPTY_INTENTION'
      ? { ok: false, error: { code: 'EMPTY_INTENTION' } }
      : { ok: false, error: { code: 'NO_LATIN_LETTER', ignored: normalized.ignored } };
  }

  const { letters, ignored } = normalized.intention;
  const built = buildKameaSigil(letters, planet);
  if (!built.ok) return { ok: false, error: { ...built.error, planet } };

  return { ok: true, sigil: built.data, planet, letterCount: letters.length, ignored };
}

/**
 * Words a trace error for the user: what went wrong and what to do.
 *
 * @param error - Error returned by `traceKamea`.
 * @param strings - Interface texts in the current language.
 * @returns The message shown under the intention field.
 */
export function traceErrorMessage(error: TraceError, strings: AppStrings): string {
  switch (error.code) {
    case 'EMPTY_INTENTION':
      return strings.errors.empty;
    case 'NO_LATIN_LETTER':
      return strings.errors.noLatinLetter(error.ignored);
    case 'TOO_FEW_LETTERS':
      return strings.errors.tooFewLetters;
    case 'SINGLE_CELL':
      return strings.errors.singleCell(error.number, error.planet);
    case 'INVALID_LETTER':
      return strings.errors.invalidLetter;
  }
}
