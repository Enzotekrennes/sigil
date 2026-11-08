/**
 * Builds a sigil with Austin Osman Spare's method, composed as a bind rune:
 * the normalised letters are reduced (duplicates, vowels by default;
 * decision D4), each retained letter is redrawn with straight segments
 * (D20) and hooked onto a vertical stem (D19), several seeded runes are drawn
 * (D6) and the one with the lowest penalty kept (no hatches, ink under the
 * ceiling, taller than wide, symmetric and balanced), its shared strokes
 * drawn once and any hatch left on a very long word corrected (see
 * `correctHatches`). Also produces the explanation steps.
 *
 * Exposes `buildSpareSigil` with its options, result and error types. Pure and
 * deterministic. Does not normalise the typed text: letters arrive from
 * `normalizeIntention`.
 */
import { reduceForSpare } from '../intention/index.ts';
import { DRAWING_SIZE, FRAME_MARGIN, FRAME_SIZE } from '../sigil/frame.ts';
import type { ExplanationStep, Point, Sigil, SpareAngularSkeleton } from '../sigil/types.ts';
import { getAngularGlyph } from './angular.ts';
import { generateSpareCandidates } from './generateSpareCandidates.ts';
import type { SpareCompositionError } from './generateSpareCandidates.ts';
import { roundCoordinate } from './geometry.ts';
import { getGlyph, isCapitalLetter } from './glyphs/index.ts';
import type { CapitalLetter } from './glyphs/index.ts';
import { correctHatches } from './hatches.ts';
import { chooseRune, scoreRune } from './runeScore.ts';

/** Settings of a Spare sigil. */
export interface SpareOptions {
  /** Keep the vowels and remove only duplicates (D4); part of the seed. */
  readonly keepVowels: boolean;
  /** Variant number, 0 for the first sigil, incremented by "another variant". */
  readonly variant: number;
}

/** Business error preventing a Spare sigil from being drawn. */
export type SpareError =
  /**
   * The reduction left no letter. `suggestKeepVowels` is true when keeping
   * the vowels would leave some, so the interface can offer that option.
   */
  | { readonly code: 'NO_LETTER_LEFT'; readonly suggestKeepVowels: boolean }
  /**
   * The composition refused its input: `INVALID_LETTER` (index in the letters
   * given to `buildSpareSigil`) or `INVALID_VARIANT`; the other codes cannot
   * occur after the reduction.
   */
  | SpareCompositionError;

/** Outcome of `buildSpareSigil`: the sigil, or the reason it cannot be drawn. */
export type SpareResult =
  { readonly ok: true; readonly data: Sigil } | { readonly ok: false; readonly error: SpareError };

/**
 * Spare sigils carry no mark. The method draws a single fused glyph with no
 * reading direction: a start circle or an end bar would add a feature that is
 * neither a letter nor part of the seal, and the tracing order only serves
 * the animation.
 */
const SPARE_MARKS: Sigil['marks'] = [];

/**
 * Draws the Spare sigil of an intention.
 *
 * @param letters - Normalised letters of the intention, one upper-case A–Z
 *   letter per item, in order, repetitions included.
 * @param options - Vowel setting and variant number.
 * @returns `{ ok: true, data }` with the sigil in the 0–100 frame (no marks,
 *   `seed` set, a vertical stem on x = 50, every point within 40 of the frame
 *   centre, hence inside the margin), or `{ ok: false, error }` with
 *   `INVALID_LETTER`, `NO_LETTER_LEFT` or `INVALID_VARIANT`. Never throws.
 *   The same arguments always give deeply equal results.
 */
export function buildSpareSigil(letters: readonly string[], options: SpareOptions): SpareResult {
  for (const [index, letter] of letters.entries()) {
    if (!isCapitalLetter(letter)) {
      return { ok: false, error: { code: 'INVALID_LETTER', letter, index } };
    }
  }

  const { keepVowels, variant } = options;
  const reduction = reduceForSpare(letters, { keepVowels });
  if (!reduction.ok) {
    return {
      ok: false,
      error: { code: 'NO_LETTER_LEFT', suggestKeepVowels: reduction.suggestKeepVowels },
    };
  }

  const generated = generateSpareCandidates(reduction.kept, options);
  if (!generated.ok) return generated;
  const { seed, order, style, candidates } = generated.data;

  const chosenIndex = chooseRune(candidates.map((candidate) => candidate.score));
  const chosen = candidates[chosenIndex];
  // `chooseRune` returns an index of the list it was given; the guard is for the compiler.
  if (chosen === undefined) throw new Error('Chosen candidate missing.');
  // The score keeps hatches out of nearly every rune; the long words whose
  // letters are too small for any candidate to avoid them are corrected here.
  const strokes = correctHatches(chosen.strokes);
  const score =
    strokes === chosen.strokes ? chosen.score : scoreRune(strokes, chosen.letters, style);

  const steps: ExplanationStep[] = [
    {
      kind: 'spare-letter-reduction',
      letters: [...letters],
      keepVowels,
      removed: reduction.removed,
      kept: reduction.kept,
    },
    {
      kind: 'spare-angular-skeletons',
      letters: reduction.kept.filter(isCapitalLetter).map(describeSkeleton),
    },
    {
      kind: 'spare-stem-attachments',
      stem: chosen.stem,
      order: [...order],
      letters: chosen.letters,
    },
    {
      kind: 'spare-candidate-choice',
      variant,
      style,
      candidateCount: candidates.length,
      chosenIndex,
      score,
    },
    {
      kind: 'spare-simplification',
      segmentCountBefore: chosen.segmentCountBefore,
      segmentCountAfter: strokes.reduce((count, stroke) => count + stroke.length - 1, 0),
    },
  ];

  return {
    ok: true,
    data: {
      strokes,
      marks: SPARE_MARKS,
      viewBox: { x: 0, y: 0, width: FRAME_SIZE, height: FRAME_SIZE },
      steps,
      seed,
    },
  };
}

/**
 * Describes a letter's Hershey and angular skeletons for the explanation
 * panel, both upright and fitted the same way into the drawing area.
 *
 * @param letter - Upper-case letter A–Z.
 * @returns The two skeletons, the Hershey glyph's larger side spanning the drawing area,
 *   centred on their common bounding box, and the angular segment count.
 */
function describeSkeleton(letter: CapitalLetter): SpareAngularSkeleton {
  const glyph = getGlyph(letter);
  const angular = getAngularGlyph(letter);
  const { bounds } = glyph;
  const factor = DRAWING_SIZE / Math.max(bounds.width, bounds.height);
  const left = FRAME_MARGIN + (DRAWING_SIZE - bounds.width * factor) / 2;
  const top = FRAME_MARGIN + (DRAWING_SIZE - bounds.height * factor) / 2;
  const fit = (stroke: readonly Point[]): Point[] =>
    stroke.map((point) => ({
      x: roundCoordinate(left + (point.x - bounds.x) * factor),
      y: roundCoordinate(top + (point.y - bounds.y) * factor),
    }));
  return {
    letter,
    glyph: glyph.strokes.map(fit),
    angular: angular.strokes.map(fit),
    segmentCount: angular.strokes.reduce((count, stroke) => count + stroke.length - 1, 0),
  };
}
