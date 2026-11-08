/**
 * Generates the candidate compositions of a Spare sigil: from the retained
 * letters and the settings, derives the seed (decision D6), composes
 * `candidateCountFor(letters)` superimpositions of the letters' skeletons and fits each
 * one into the 0–100 sigil frame.
 *
 * Exposes `generateSpareCandidates`, its options, result and error types and
 * the number of candidates. Pure and deterministic. Does not choose between
 * the candidates, merge strokes or simplify: scoring and building the final
 * `Sigil` come after it.
 */
import { createRandom } from '../../lib/random.ts';
import { DRAWING_SIZE, FRAME_MARGIN } from '../sigil/frame.ts';
import type { Point } from '../sigil/types.ts';
import { roundCoordinate } from './geometry.ts';
import { isCapitalLetter } from './glyphs/index.ts';
import type { CapitalLetter } from './glyphs/index.ts';
import { composeLetters, leadLetterFor } from './placement.ts';
import type { Composition, LetterPlacement } from './placement.ts';
import { spareSeed } from './seed.ts';

/**
 * Fewest compositions drawn per seed. Two dozen give a long intention enough
 * different orientations and offsets to find a balanced one in which every
 * letter is tangled: with many letters, each one has many strokes to hide among.
 */
export const MIN_CANDIDATE_COUNT = 24;

/**
 * Most compositions drawn per seed. A short intention (four or five letters)
 * has few strokes to hide each letter among, and needs this many draws to
 * contain one where every letter is laid on its side or well tangled.
 */
export const MAX_CANDIDATE_COUNT = 96;

/**
 * Letters × candidates scored per sigil. Scoring cost grows with both, so a
 * fixed budget keeps every intention within about the same time: 480 is five
 * letters × 96. A whole Spare sigil was measured at about 68 ms with a
 * four-times slowed CPU on the reference boards, and the first display at
 * 217 ms at worst under the same slowdown, at acceptance; the time on a real
 * phone is still to be measured.
 */
export const SCORING_BUDGET = 480;

/**
 * Number of compositions drawn for a given number of letters: the scoring
 * budget shared among the letters, within [`MIN_CANDIDATE_COUNT`, `MAX_CANDIDATE_COUNT`].
 *
 * @param letterCount - Number of retained letters, at least 1.
 * @returns The number of candidates, an integer.
 */
export function candidateCountFor(letterCount: number): number {
  const shared = Math.floor(SCORING_BUDGET / Math.max(1, letterCount));
  return Math.min(MAX_CANDIDATE_COUNT, Math.max(MIN_CANDIDATE_COUNT, shared));
}

/** Settings of a Spare sigil, besides its letters. */
export interface SpareCandidateOptions {
  /** Whether vowels were kept by the reduction; part of the seed. */
  readonly keepVowels: boolean;
  /** Variant number, 0 for the first sigil; each number gives other candidates. */
  readonly variant: number;
}

/** One composition of the letters, fitted into the 0–100 frame. */
export interface SpareCandidate {
  /**
   * Strokes in the 0–100 frame, letter by letter in input order and each
   * glyph's stroke order kept; every point within the frame's margin.
   */
  readonly strokes: readonly (readonly Point[])[];
  /** Index in `placements` of the letter each stroke belongs to, same length as `strokes`. */
  readonly strokeLetters: readonly number[];
  /** How each letter was transformed, in input order, for the explanation panel. */
  readonly placements: readonly LetterPlacement[];
}

/** The candidates of one seed. */
export interface SpareCandidates {
  /** Seed every candidate was drawn from, to be stored in `Sigil.seed`. */
  readonly seed: number;
  /** `candidateCountFor(letters.length)` candidates, in draw order. */
  readonly candidates: readonly SpareCandidate[];
}

/** Why candidates cannot be generated. */
export type SpareCompositionError =
  /** No letter to compose (the reduction should have reported it first). */
  | { readonly code: 'NO_LETTERS' }
  /** An item is not a single upper-case letter A–Z (normalisation was skipped). */
  | { readonly code: 'INVALID_LETTER'; readonly letter: string; readonly index: number }
  /** A letter appears twice (the Spare reduction was skipped). */
  | { readonly code: 'DUPLICATE_LETTER'; readonly letter: string; readonly index: number }
  /** The variant number is not an integer ≥ 0. */
  | { readonly code: 'INVALID_VARIANT'; readonly variant: number };

/** Outcome of `generateSpareCandidates`: the candidates, or the reason there are none. */
export type SpareCandidatesResult =
  | { readonly ok: true; readonly data: SpareCandidates }
  | { readonly ok: false; readonly error: SpareCompositionError };

/**
 * Draws the candidate compositions of a Spare sigil.
 *
 * @param letters - Retained letters after the Spare reduction: distinct
 *   upper-case letters A–Z, in intention order.
 * @param options - Vowel setting and variant number, both part of the seed.
 *   The variant also chooses the lead letter, drawn largest (see
 *   `leadLetterFor`), so that successive variants are led by different
 *   letters and differ in structure.
 * @returns `{ ok: true, data }` with the seed and `candidateCountFor(letters.length)`
 *   candidates, or `{ ok: false, error }` with `NO_LETTERS`,
 *   `INVALID_LETTER`, `DUPLICATE_LETTER` or `INVALID_VARIANT`. Never throws.
 *   The same arguments always give deeply equal results.
 */
export function generateSpareCandidates(
  letters: readonly string[],
  options: SpareCandidateOptions,
): SpareCandidatesResult {
  const validation = validateLetters(letters);
  if (!validation.ok) return validation;
  const { variant, keepVowels } = options;
  if (!Number.isSafeInteger(variant) || variant < 0) {
    return { ok: false, error: { code: 'INVALID_VARIANT', variant } };
  }

  const seed = spareSeed({ letters, keepVowels, variant });
  const random = createRandom(seed);
  const candidates = Array.from({ length: candidateCountFor(letters.length) }, () =>
    fitToFrame(composeLetters(validation.data, random, leadLetterFor(validation.data, variant))),
  );
  return { ok: true, data: { seed, candidates } };
}

/**
 * Checks that the letters can be composed.
 *
 * @param letters - Letters as received.
 * @returns The same letters typed as capitals, or the first problem found.
 */
function validateLetters(
  letters: readonly string[],
):
  | { readonly ok: true; readonly data: CapitalLetter[] }
  | { readonly ok: false; readonly error: SpareCompositionError } {
  if (letters.length === 0) return { ok: false, error: { code: 'NO_LETTERS' } };
  const seen = new Set<string>();
  const capitals: CapitalLetter[] = [];
  for (const [index, letter] of letters.entries()) {
    if (!isCapitalLetter(letter)) {
      return { ok: false, error: { code: 'INVALID_LETTER', letter, index } };
    }
    if (seen.has(letter)) {
      return { ok: false, error: { code: 'DUPLICATE_LETTER', letter, index } };
    }
    seen.add(letter);
    capitals.push(letter);
  }
  return { ok: true, data: capitals };
}

/**
 * Scales a composition uniformly and centres its bounding box in the drawing
 * area, so that its larger side spans the area exactly. Proportions are kept;
 * balance (centre of gravity) is left to the scoring.
 *
 * @param composition - Letters placed in composition units.
 * @returns The candidate, every point within [`FRAME_MARGIN`, 100 − `FRAME_MARGIN`].
 */
function fitToFrame(composition: Composition): SpareCandidate {
  const points = composition.strokes.flat();
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;
  // Glyphs always have extent, so `size` is positive; the guard documents it.
  const size = Math.max(width, height) || 1;
  const factor = DRAWING_SIZE / size;
  const left = FRAME_MARGIN + (DRAWING_SIZE - width * factor) / 2;
  const top = FRAME_MARGIN + (DRAWING_SIZE - height * factor) / 2;

  const strokes = composition.strokes.map((stroke) =>
    stroke.map((point) => ({
      x: roundCoordinate(left + (point.x - minX) * factor),
      y: roundCoordinate(top + (point.y - minY) * factor),
    })),
  );
  return { strokes, strokeLetters: composition.strokeLetters, placements: composition.placements };
}
