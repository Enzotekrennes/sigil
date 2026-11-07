/**
 * Builds a sigil with Austin Osman Spare's method: the normalised letters are
 * reduced (duplicates, vowels by default; decision D4), their single-stroke
 * skeletons superimposed in several seeded compositions (D6, D7), the
 * best-balanced composition kept, its strokes merged and simplified, and the
 * result recentred on its centre of gravity. Also produces the explanation steps.
 *
 * Exposes `buildSpareSigil` with its options, result and error types. Pure and
 * deterministic. Does not normalise the typed text: letters arrive from
 * `normalizeIntention`.
 */
import { reduceForSpare } from '../intention/index.ts';
import { DRAWING_SIZE, FRAME_MARGIN, FRAME_SIZE } from '../sigil/frame.ts';
import type { ExplanationStep, Point, Sigil, SpareLetterPlacement } from '../sigil/types.ts';
import { generateSpareCandidates } from './generateSpareCandidates.ts';
import type { SpareCandidate, SpareCompositionError } from './generateSpareCandidates.ts';
import { roundCoordinate } from './geometry.ts';
import { getGlyph, isCapitalLetter } from './glyphs/index.ts';
import { applyRecentring, chooseCandidate, recentringFor } from './score.ts';
import type { Recentring } from './score.ts';
import { simplifyStrokes } from './simplify.ts';

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
 *   `seed` set, centre of gravity on the frame centre, every point within the
 *   margin), or `{ ok: false, error }` with `INVALID_LETTER`,
 *   `NO_LETTER_LEFT` or `INVALID_VARIANT`. Never throws. The same arguments
 *   always give deeply equal results.
 */
export function buildSpareSigil(letters: readonly string[], options: SpareOptions): SpareResult {
  for (const [index, letter] of letters.entries()) {
    if (!isCapitalLetter(letter)) {
      return { ok: false, error: { code: 'INVALID_LETTER', letter, index } };
    }
  }

  const { keepVowels } = options;
  const reduction = reduceForSpare(letters, { keepVowels });
  if (!reduction.ok) {
    return {
      ok: false,
      error: { code: 'NO_LETTER_LEFT', suggestKeepVowels: reduction.suggestKeepVowels },
    };
  }

  const generated = generateSpareCandidates(reduction.kept, options);
  if (!generated.ok) return generated;
  const { seed, candidates } = generated.data;

  const { index, scores } = chooseCandidate(candidates);
  const chosen = candidates[index];
  const score = scores[index];
  // `chooseCandidate` returns an index of the list it was given; the guard is for the compiler.
  if (chosen === undefined || score === undefined) throw new Error('Chosen candidate missing.');

  const simplified = simplifyStrokes(chosen.strokes);
  // The unmerged letters are part of the envelope, so the panel's
  // superimposed letters fit in the frame as well as the sigil.
  const recentring = recentringFor(simplified.strokes, chosen.strokes.flat());
  const strokes = applyRecentring(simplified.strokes, recentring).filter(
    (stroke) => stroke.length >= 2,
  );

  const steps: ExplanationStep[] = [
    {
      kind: 'spare-letter-reduction',
      letters: [...letters],
      keepVowels,
      removed: reduction.removed,
      kept: reduction.kept,
    },
    { kind: 'spare-letter-placements', letters: describePlacements(chosen, recentring) },
    {
      kind: 'spare-candidate-choice',
      candidateCount: candidates.length,
      chosenIndex: index,
      centreOffset: score.centreOffset,
      fill: score.fill,
      isolatedLetters: score.isolatedLetters,
      uprightLetters: score.uprightLetters,
      penalty: score.penalty,
    },
    {
      kind: 'spare-simplification',
      segmentCountBefore: simplified.segmentCountBefore,
      segmentCountAfter: simplified.segmentCountAfter,
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
 * Describes each letter of the chosen composition for the explanation panel.
 *
 * @param candidate - Chosen composition.
 * @param recentring - Move applied to the final sigil, applied to the letters too.
 * @returns One entry per retained letter, in input order.
 */
function describePlacements(
  candidate: SpareCandidate,
  recentring: Recentring,
): SpareLetterPlacement[] {
  return candidate.placements.map((placement, letterIndex) => ({
    letter: placement.letter,
    mirrored: placement.mirrored,
    rotation: placement.rotation,
    scale: placement.scale,
    sharedStemWith: placement.sharedStemWith,
    glyph: uprightGlyph(placement.letter),
    strokes: applyRecentring(
      candidate.strokes.filter((_, stroke) => candidate.strokeLetters[stroke] === letterIndex),
      recentring,
    ),
  }));
}

/**
 * Fits a letter's untransformed skeleton into the drawing area, centred.
 *
 * @param letter - Upper-case letter A–Z.
 * @returns Its strokes in the 0–100 frame, larger side spanning the drawing area.
 */
function uprightGlyph(letter: string): Point[][] {
  const { strokes, bounds } = getGlyph(letter);
  const factor = DRAWING_SIZE / Math.max(bounds.width, bounds.height);
  const left = FRAME_MARGIN + (DRAWING_SIZE - bounds.width * factor) / 2;
  const top = FRAME_MARGIN + (DRAWING_SIZE - bounds.height * factor) / 2;
  return strokes.map((stroke) =>
    stroke.map((point) => ({
      x: roundCoordinate(left + (point.x - bounds.x) * factor),
      y: roundCoordinate(top + (point.y - bounds.y) * factor),
    })),
  );
}
