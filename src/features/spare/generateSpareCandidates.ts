/**
 * Generates the candidate bind runes of a Spare sigil (plan decision D19):
 * from the retained letters and the settings, derives the seed (decision
 * D6), fixes the order the variant hangs the letters in, composes
 * `candidateCountFor(letters)` runes in the style of the variant, fits each one into the disc of the
 * 0–100 frame, merges its shared strokes and scores it.
 *
 * Exposes `generateSpareCandidates`, `candidateCountFor`, `letterOrderFor`,
 * the options, result and error types. Pure and deterministic. Does not
 * choose between the candidates or build the `Sigil`: `buildSpareSigil` does.
 */
import { createRandom } from '../../lib/random.ts';
import { FRAME_SIZE } from '../sigil/frame.ts';
import type { Point, SpareRuneStyle } from '../sigil/types.ts';
import { composeBindRune } from './bindRune.ts';
import type { RuneComposition, RuneLetter } from './bindRune.ts';
import { roundCoordinate } from './geometry.ts';
import { isCapitalLetter } from './glyphs/index.ts';
import type { CapitalLetter } from './glyphs/index.ts';
import { scoreRune } from './runeScore.ts';
import type { RuneScore } from './runeScore.ts';
import { spareSeed } from './seed.ts';
import { simplifyStrokes } from './simplify.ts';

/**
 * Radius of the disc every rune is fitted into, around the frame centre, in
 * frame units: the drawing area's half side, so that the rune stays inside the
 * margin and the optional framing circle surrounds it.
 */
export const DISC_RADIUS = 40;

/**
 * Fewest runes drawn per seed, reached from sixteen letters on. Enough for
 * the score to find a clean rune among long words, whose letters leave few
 * clean layouts anyway, and cheap enough for the time limit (see `SCORING_BUDGET`).
 */
export const MIN_CANDIDATE_COUNT = 24;

/**
 * Most runes drawn per seed. A short word has few ways to be hung; drawing
 * more than this adds runes that repeat earlier ones.
 */
export const MAX_CANDIDATE_COUNT = 64;

/**
 * Letters × runes composed per sigil. Merging and scoring cost grows with
 * both, so a fixed budget keeps every word within about the same time: 384
 * is six letters × 64. Twelve letters × 32 runes take 77–96 ms with a
 * four-times slowed CPU once the page has drawn them a first time, against
 * the plan's 150 ms; the very first one takes 170–190 ms, while the engine
 * compiles the code, and drawing fewer runes does not shorten it.
 */
export const SCORING_BUDGET = 384;

/** Most letters whose every order is cycled through by successive variants (3! = 6 orders). */
export const MAX_CYCLED_LETTERS = 3;

/**
 * Number of runes drawn for a given number of letters: the budget shared
 * among the letters, within [`MIN_CANDIDATE_COUNT`, `MAX_CANDIDATE_COUNT`].
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
  /** Variant number, 0 for the first sigil; each number gives another order and other runes. */
  readonly variant: number;
}

/** A letter of a candidate rune, placed in the 0–100 frame. */
export interface SpareCandidateLetter extends Omit<RuneLetter, 'top' | 'scale'> {
  /** y of the letter's highest point, in the frame. */
  readonly top: number;
  /** y of the letter's lowest point, in the frame. */
  readonly bottom: number;
  /** The letter's strokes (and its double's) in the frame, before merging. */
  readonly strokes: readonly (readonly Point[])[];
}

/** One rune, fitted into the frame, merged and scored. */
export interface SpareCandidate {
  /** Merged polylines in the 0–100 frame: the stem first, shared strokes drawn once. */
  readonly strokes: readonly (readonly Point[])[];
  /** Ends of the stem, top first, on x = 50. */
  readonly stem: {
    /** Upper end of the stem, in the 0–100 frame. */
    readonly top: Point;
    /** Lower end of the stem, straight below `top`. */
    readonly bottom: Point;
  };
  /** The letters in the order they were given (not the hanging order). */
  readonly letters: readonly SpareCandidateLetter[];
  /** Segments of the stem and the placed letters before merging. */
  readonly segmentCountBefore: number;
  /** Segments once merged. */
  readonly segmentCountAfter: number;
  /** Measures of the rune and their weighted penalty; the candidate with the lowest penalty is chosen. */
  readonly score: RuneScore;
}

/** The candidates of one seed. */
export interface SpareCandidates {
  /** Seed every candidate was drawn from, to be stored in `Sigil.seed`. */
  readonly seed: number;
  /** Letters from the top of the stem to the bottom, shared by every candidate. */
  readonly order: readonly CapitalLetter[];
  /** Layout style of the variant, shared by every candidate. */
  readonly style: SpareRuneStyle;
  /** `candidateCountFor(letters.length)` candidates, in draw order. */
  readonly candidates: readonly SpareCandidate[];
}

/** Why candidates cannot be generated. */
export type SpareCompositionError =
  /** No letter to compose (the reduction should have reported it first). */
  | { readonly code: 'NO_LETTERS' }
  /** An item is not a single upper-case letter A–Z (normalisation was skipped). */
  | {
      readonly code: 'INVALID_LETTER';
      /** The item refused, as given. */
      readonly letter: string;
      /** Zero-based position of the item in the letters given. */
      readonly index: number;
    }
  /** A letter appears twice (the Spare reduction was skipped). */
  | {
      readonly code: 'DUPLICATE_LETTER';
      /** The repeated letter. */
      readonly letter: string;
      /** Zero-based position of its second occurrence in the letters given. */
      readonly index: number;
    }
  /** The variant number is not an integer ≥ 0. */
  | {
      readonly code: 'INVALID_VARIANT';
      /** The variant number refused, as given. */
      readonly variant: number;
    };

/** Outcome of `generateSpareCandidates`: the candidates, or the reason there are none. */
export type SpareCandidatesResult =
  | { readonly ok: true; readonly data: SpareCandidates }
  | { readonly ok: false; readonly error: SpareCompositionError };

/**
 * Draws the candidate runes of a Spare sigil.
 *
 * @param letters - Retained letters after the Spare reduction: distinct
 *   upper-case letters A–Z, in intention order.
 * @param options - Vowel setting and variant number, both part of the seed;
 *   the variant also fixes the order of the letters (see `letterOrderFor`).
 * @returns `{ ok: true, data }` with the seed, the order and
 *   `candidateCountFor(letters.length)` candidates, or `{ ok: false, error }`
 *   with `NO_LETTERS`, `INVALID_LETTER`, `DUPLICATE_LETTER` or
 *   `INVALID_VARIANT`. Never throws. The same arguments always give deeply
 *   equal results.
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
  const capitals = validation.data;
  const order = letterOrderFor(capitals.length, variant, random).map(
    (index) => capitals[index] ?? 'A',
  );
  const style = styleFor(capitals.length, variant);
  const candidates = Array.from({ length: candidateCountFor(capitals.length) }, () =>
    finishCandidate(composeBindRune(order, random, style), order, capitals, style),
  );
  return { ok: true, data: { seed, order, style, candidates } };
}

/**
 * Order in which a variant hangs the letters from the top of the stem.
 * Variant 0 keeps the intention order. Up to `MAX_CYCLED_LETTERS` letters,
 * successive variants go through every order in turn, so that the first
 * variants of a short word never repeat an order; beyond, each variant
 * shuffles the letters with its own generator.
 *
 * @param letterCount - Number of letters, at least 1.
 * @param variant - Variant number, integer ≥ 0.
 * @param random - Generator of the variant, advanced only when shuffling.
 * @returns A permutation of the indices 0 … letterCount − 1.
 */
export function letterOrderFor(
  letterCount: number,
  variant: number,
  random: () => number,
): number[] {
  const indices = Array.from({ length: letterCount }, (_, index) => index);
  if (variant === 0) return indices;
  if (letterCount <= MAX_CYCLED_LETTERS) {
    const permutations = permutationsOf(indices);
    return permutations[variant % permutations.length] ?? indices;
  }
  for (let index = indices.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const current = indices[index] ?? 0;
    indices[index] = indices[other] ?? 0;
    indices[other] = current;
  }
  return indices;
}

/**
 * Layout style successive variants cycle through. Short words open on a
 * symmetric rune, the commonest kind among the references; from
 * `LONG_WORD_LETTERS` letters on, a symmetric rune hangs one letter per level
 * and draws them small along a long stem (one letter in eight of the drawing
 * height at six letters), so long words alternate the mixed and paired styles.
 */
export const SHORT_WORD_STYLES: readonly SpareRuneStyle[] = ['symmetric', 'paired', 'mixed'];
export const LONG_WORD_STYLES: readonly SpareRuneStyle[] = ['mixed', 'paired'];

/** Fewest letters for which a word counts as long (see `LONG_WORD_STYLES`). */
export const LONG_WORD_LETTERS = 5;

/**
 * Layout style of a variant.
 *
 * @param letterCount - Number of retained letters.
 * @param variant - Variant number, integer ≥ 0.
 * @returns The style every candidate of the variant is composed in.
 */
export function styleFor(letterCount: number, variant: number): SpareRuneStyle {
  const styles = letterCount >= LONG_WORD_LETTERS ? LONG_WORD_STYLES : SHORT_WORD_STYLES;
  return styles[variant % styles.length] ?? 'mixed';
}

/**
 * Every order of some items, the identity first.
 *
 * @param items - A few items (the count's factorial is returned).
 * @returns The permutations, in lexicographic order of positions.
 */
function permutationsOf(items: readonly number[]): number[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, position) =>
    permutationsOf(items.filter((_, other) => other !== position)).map((rest) => [item, ...rest]),
  );
}

/**
 * Fits a composed rune into the frame, merges and scores it.
 *
 * @param rune - Rune in rune units, letters in hanging order.
 * @param order - Letters in hanging order.
 * @param letters - Letters in intention order, to report them in that order.
 * @param style - Layout style the rune was composed in, for the score.
 * @returns The candidate.
 */
function finishCandidate(
  rune: RuneComposition,
  order: readonly CapitalLetter[],
  letters: readonly CapitalLetter[],
  style: SpareRuneStyle,
): SpareCandidate {
  const fit = discFit(rune);
  const placed = rune.strokes.map((stroke) => stroke.map(fit));
  const merged = simplifyStrokes(placed);
  const strokes = merged.strokes.filter((stroke) => stroke.length >= 2);
  const byLetter = letters.map((letter) => {
    const index = order.indexOf(letter);
    const runeLetter = rune.letters[index];
    if (runeLetter === undefined) throw new Error(`Letter ${letter} missing from the rune.`);
    const letterStrokes = placed.filter((_, stroke) => rune.strokeLetters[stroke] === index);
    const ys = letterStrokes.flat().map((point) => point.y);
    // The extent comes from the ink: an S zigzag stops above its baseline.
    return {
      letter,
      attachment: runeLetter.attachment,
      mirrored: runeLetter.mirrored,
      doubled: runeLetter.doubled,
      side: runeLetter.side,
      top: Math.min(...ys),
      bottom: Math.max(...ys),
      strokes: letterStrokes,
    };
  });
  return {
    strokes,
    stem: {
      top: fit({ x: 0, y: rune.stem.top }),
      bottom: fit({ x: 0, y: rune.stem.bottom }),
    },
    letters: byLetter,
    segmentCountBefore: merged.segmentCountBefore,
    segmentCountAfter: merged.segmentCountAfter,
    score: scoreRune(strokes, byLetter, style),
  };
}

/**
 * The largest uniform scaling that puts a rune's stem on the frame's
 * vertical axis, its stem's middle on the frame centre, and every point within
 * `DISC_RADIUS` of the centre.
 *
 * @param rune - Rune in rune units.
 * @returns A function mapping rune units to rounded frame coordinates.
 */
function discFit(rune: RuneComposition): (point: Point) => Point {
  const middle = (rune.stem.top + rune.stem.bottom) / 2;
  const reach = Math.max(
    ...rune.strokes.flat().map((point) => Math.hypot(point.x, point.y - middle)),
  );
  // The stem has positive length, so `reach` is positive; the guard documents it.
  const factor = DISC_RADIUS / (reach || 1);
  const centre = FRAME_SIZE / 2;
  return (point) => ({
    x: roundCoordinate(centre + point.x * factor),
    y: roundCoordinate(centre + (point.y - middle) * factor),
  });
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
