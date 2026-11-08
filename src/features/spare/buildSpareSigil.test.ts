/**
 * End-to-end tests of the Spare sigil builder, from the typed word: the bind
 * rune of decision D19 on a broad sample of single words (D18) × 3 variants
 * (a continuous stem on the frame axis, every letter hooked onto it, taller
 * than wide, no hatches, ink under the ceiling, inside the frame margin and
 * the disc), straight angular letters (D20), determinism (D6), distinct
 * variants, explanation steps, and business errors.
 */
import { describe, expect, it } from 'vitest';

import { normalizeIntention } from '../intention/index.ts';
import { FRAME_MARGIN, FRAME_SIZE } from '../sigil/frame.ts';
import type { ExplanationStep, Point, Sigil } from '../sigil/types.ts';
import { getAngularGlyph } from './angular.ts';
import { DISC_RADIUS } from './generateSpareCandidates.ts';
import { segmentLength, strokeSegments } from './geometry.ts';
import { isCapitalLetter } from './glyphs/index.ts';
import { findHatches } from './hatches.ts';
import { buildSpareSigil, candidateCountFor, generateSpareCandidates, spareSeed } from './index.ts';
import type { SpareError, SpareOptions } from './index.ts';
import { INK_CEILING, STEM_X } from './runeScore.ts';
import { POINT_MERGE_TOLERANCE } from './simplify.ts';

/** Default settings: vowels removed, first variant. */
const DEFAULT_OPTIONS: SpareOptions = { keepVowels: false, variant: 0 };

/** Tolerance above the 4-decimal rounding of coordinates. */
const ROUNDING_TOLERANCE = 1e-3;

/** Distance from the stem under which a point counts as on it, in frame units. */
const ON_STEM = 0.5;

/**
 * Fifty single-word intentions, French and English, from one to eight
 * retained letters: the validation board's sixteen words first.
 */
const WORDS: readonly string[] = [
  'Calme',
  'Amour',
  'Force',
  'Chance',
  'Courage',
  'Protection',
  'Sérénité',
  'Liberté',
  'Strength',
  'Luck',
  'Home',
  'Grace',
  'Energy',
  'Patience',
  'Lumière',
  'Voyage',
  'Paix',
  'Joie',
  'Santé',
  'Abondance',
  'Confiance',
  'Gratitude',
  'Harmonie',
  'Sagesse',
  'Bonheur',
  'Succès',
  'Victoire',
  'Espoir',
  'Lumineux',
  'Puissance',
  'Wisdom',
  'Healing',
  'Peace',
  'Wealth',
  'Clarity',
  'Focus',
  'Balance',
  'Freedom',
  'Growth',
  'Success',
  'Harmony',
  'Faith',
  'Trust',
  'Prosperity',
  'Renaissance',
  'Transformation',
  'Determination',
  'Mindfulness',
  'Résilience',
  'Yeux',
];

/**
 * Normalised letters of a word.
 *
 * @param text - Word as typed.
 * @returns Its letters A–Z.
 */
function lettersOf(text: string): string[] {
  const result = normalizeIntention(text);
  if (!result.ok) throw new Error(`Unexpected normalisation error ${result.error}`);
  return result.intention.letters;
}

/**
 * Builds the sigil of a word, failing the test on a business error.
 *
 * @param text - Word as typed.
 * @param options - Spare settings.
 * @returns The sigil.
 */
function sigilOf(text: string, options: SpareOptions = DEFAULT_OPTIONS): Sigil {
  const result = buildSpareSigil(lettersOf(text), options);
  if (!result.ok) throw new Error(`Unexpected Spare error ${result.error.code}`);
  return result.data;
}

/**
 * Builds a sigil and returns its business error, failing the test otherwise.
 *
 * @param letters - Normalised letters.
 * @param options - Spare settings.
 * @returns The error.
 */
function errorOf(letters: readonly string[], options: SpareOptions = DEFAULT_OPTIONS): SpareError {
  const result = buildSpareSigil(letters, options);
  if (result.ok) throw new Error('Expected a Spare error');
  return result.error;
}

/**
 * Finds the step of a given kind, failing the test when it is missing.
 *
 * @param sigil - Sigil to read.
 * @param kind - Step kind.
 * @returns The step, narrowed to its kind.
 */
function stepOf<K extends ExplanationStep['kind']>(
  sigil: Sigil,
  kind: K,
): Extract<ExplanationStep, { kind: K }> {
  const step = sigil.steps.find(
    (candidate): candidate is Extract<ExplanationStep, { kind: K }> => candidate.kind === kind,
  );
  if (step === undefined) throw new Error(`Missing step ${kind}`);
  return step;
}

/**
 * Stretches of the vertical x = `STEM_X` that the strokes draw, merged.
 *
 * @param strokes - Polylines in the 0–100 frame.
 * @returns Disjoint [top, bottom] intervals, top first.
 */
function stemCoverage(strokes: readonly (readonly Point[])[]): [number, number][] {
  const pieces = strokeSegments(strokes)
    .filter(({ start, end }) => start.x === STEM_X && end.x === STEM_X)
    .map(({ start, end }): [number, number] => [Math.min(start.y, end.y), Math.max(start.y, end.y)])
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [top, bottom] of pieces) {
    const last = merged[merged.length - 1];
    if (last !== undefined && top <= last[1] + ROUNDING_TOLERANCE)
      last[1] = Math.max(last[1], bottom);
    else merged.push([top, bottom]);
  }
  return merged;
}

/**
 * Whether some strokes touch or cross the stem.
 *
 * @param strokes - Polylines in the 0–100 frame.
 * @returns True when a point lies on the stem or a segment has ends on both sides of it.
 */
function touchesStem(strokes: readonly (readonly Point[])[]): boolean {
  return strokes.some((stroke) =>
    stroke.some((point, index) => {
      if (Math.abs(point.x - STEM_X) <= ON_STEM) return true;
      const previous = stroke[index - 1];
      return previous !== undefined && (previous.x - STEM_X) * (point.x - STEM_X) < 0;
    }),
  );
}

/**
 * Total length of polylines.
 *
 * @param strokes - Polylines in the 0–100 frame.
 * @returns The sum of their segment lengths.
 */
function inkLength(strokes: readonly (readonly Point[])[]): number {
  return strokeSegments(strokes).reduce((sum, segment) => sum + segmentLength(segment), 0);
}

/** Distance under which a stroke end counts as resting on another stroke. */
const JOINT_DISTANCE = 1e-6;

/** The 26 letters, each drawn alone. */
const ALPHABET: readonly string[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
];

/**
 * Distance from a point to a polyline.
 *
 * @param point - Point measured.
 * @param polyline - Polyline.
 * @returns The smallest distance to one of its segments; infinite without segment.
 */
function distanceToPolyline(point: Point, polyline: readonly Point[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const { start, end } of strokeSegments([polyline])) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const squared = dx * dx + dy * dy;
    const t =
      squared === 0
        ? 0
        : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / squared));
    best = Math.min(best, Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy));
  }
  return best;
}

/**
 * Joints of the letters as placed on the stem, before merging: ends of a
 * stroke resting on another stroke of the same letter (a doubled letter's
 * two copies counted apart, since each copy overlaps the other's stem).
 *
 * @param sigil - A Spare sigil.
 * @returns The joint points, with their letter for messages.
 */
function placedJoints(sigil: Sigil): { letter: string; end: Point }[] {
  return stepOf(sigil, 'spare-stem-attachments').letters.flatMap((letter) => {
    const half = letter.strokes.length / 2;
    const copies = letter.doubled
      ? [letter.strokes.slice(0, half), letter.strokes.slice(half)]
      : [letter.strokes];
    return copies.flatMap((strokes) =>
      strokes.flatMap((stroke, index) =>
        [stroke[0], stroke[stroke.length - 1]].flatMap((end) =>
          end !== undefined &&
          strokes.some(
            (other, otherIndex) =>
              otherIndex !== index && distanceToPolyline(end, other) < JOINT_DISTANCE,
          )
            ? [{ letter: letter.letter, end }]
            : [],
        ),
      ),
    );
  });
}

/**
 * Whether a joint of a placed letter still holds in the sigil: at the joint,
 * or where merging moved it (at most `POINT_MERGE_TOLERANCE` away), strokes
 * of two different polylines meet within `JOINT_DISTANCE`.
 *
 * @param sigil - The finished sigil.
 * @param end - The joint before merging.
 * @returns True when the joint is still closed.
 */
function jointHolds(sigil: Sigil, end: Point): boolean {
  const meets = (point: Point): boolean =>
    sigil.strokes.filter((stroke) => distanceToPolyline(point, stroke) < JOINT_DISTANCE).length >=
    2;
  return (
    meets(end) ||
    sigil.strokes
      .flat()
      .some(
        (point) =>
          Math.hypot(point.x - end.x, point.y - end.y) <= POINT_MERGE_TOLERANCE && meets(point),
      )
  );
}

describe('buildSpareSigil', () => {
  it('gives the same sigil for the same word and settings, seeded by D6', () => {
    const first = sigilOf('Calme');

    expect(sigilOf('Calme')).toEqual(first);
    expect(first.seed).toBe(spareSeed({ letters: ['C', 'L', 'M'], ...DEFAULT_OPTIONS }));
  });

  it('gives the same sigil for « calme ! » as for « Calme »', () => {
    expect(sigilOf('calme !')).toEqual(sigilOf('Calme'));
  });

  it('gives each variant number a stable sigil, different from the others', () => {
    for (const word of ['Amour', 'Calme', 'Strength']) {
      const variants = [0, 1, 2, 3].map((variant) => sigilOf(word, { keepVowels: false, variant }));
      variants.forEach((sigil, variant) => {
        expect(sigilOf(word, { keepVowels: false, variant })).toEqual(sigil);
        for (const other of variants.slice(variant + 1)) {
          expect(other.strokes).not.toEqual(sigil.strokes);
          expect(other.seed).not.toBe(sigil.seed);
        }
      });
    }
  });

  it(
    `draws a clean bind rune for ${String(WORDS.length)} words × 3 variants`,
    { timeout: 60_000 },
    () => {
      const centre = FRAME_SIZE / 2;
      for (const word of WORDS) {
        for (const variant of [0, 1, 2]) {
          const sigil = sigilOf(word, { keepVowels: false, variant });
          const label = `${word} v${String(variant)}`;
          const { stem, letters } = stepOf(sigil, 'spare-stem-attachments');

          // A continuous stem on the frame axis, over most of its height.
          expect(stemCoverage(sigil.strokes), label).toEqual([[stem.top.y, stem.bottom.y]]);
          expect(stem.bottom.y - stem.top.y, label).toBeGreaterThanOrEqual(
            (2 * DISC_RADIUS) / Math.sqrt(2),
          );

          // Every letter hooked onto it, within its length.
          for (const letter of letters) {
            expect(touchesStem(letter.strokes), `${label} ${letter.letter}`).toBe(true);
            expect(letter.top, label).toBeGreaterThanOrEqual(stem.top.y - ROUNDING_TOLERANCE);
            expect(letter.bottom, label).toBeLessThanOrEqual(stem.bottom.y + ROUNDING_TOLERANCE);
          }

          // Taller than wide, no hatches, ink under the ceiling.
          const points = sigil.strokes.flat();
          const xs = points.map((point) => point.x);
          const ys = points.map((point) => point.y);
          const width = Math.max(...xs) - Math.min(...xs);
          expect(Math.max(...ys) - Math.min(...ys), label).toBeGreaterThan(width);
          expect(findHatches(strokeSegments(sigil.strokes)), label).toEqual([]);
          expect(inkLength(sigil.strokes) / (FRAME_SIZE - 2 * FRAME_MARGIN), label).toBeLessThan(
            INK_CEILING,
          );

          // Inside the disc, hence inside the margin.
          for (const point of points) {
            expect(Math.hypot(point.x - centre, point.y - centre), label).toBeLessThanOrEqual(
              DISC_RADIUS + ROUNDING_TOLERANCE,
            );
            expect(point.x).toBeGreaterThanOrEqual(FRAME_MARGIN);
            expect(point.x).toBeLessThanOrEqual(FRAME_SIZE - FRAME_MARGIN);
            expect(point.y).toBeGreaterThanOrEqual(FRAME_MARGIN);
            expect(point.y).toBeLessThanOrEqual(FRAME_SIZE - FRAME_MARGIN);
          }

          // Every stroke has at least two distinct points.
          for (const stroke of sigil.strokes) {
            expect(stroke.length, label).toBeGreaterThanOrEqual(2);
          }
        }
      }
    },
  );

  it('keeps long words with their vowels free of hatches and inside the disc', () => {
    const centre = FRAME_SIZE / 2;
    // Twelve distinct letters: the longest words the method meets.
    for (const variant of [0, 1, 2]) {
      const sigil = sigilOf('Ambidextrous', { keepVowels: true, variant });
      expect(stepOf(sigil, 'spare-letter-reduction').kept).toHaveLength(12);
      expect(findHatches(strokeSegments(sigil.strokes))).toEqual([]);
      expect(stepOf(sigil, 'spare-candidate-choice').score.hatches).toBe(0);
      for (const point of sigil.strokes.flat()) {
        expect(Math.hypot(point.x - centre, point.y - centre)).toBeLessThanOrEqual(
          DISC_RADIUS + ROUNDING_TOLERANCE,
        );
      }
    }
  });

  it('keeps every joint of the 26 letters closed in their sigil, on 3 variants', () => {
    for (const letter of ALPHABET) {
      for (const variant of [0, 1, 2]) {
        const result = buildSpareSigil([letter], { keepVowels: true, variant });
        if (!result.ok) throw new Error(`Unexpected Spare error ${result.error.code}`);
        for (const joint of placedJoints(result.data)) {
          expect(jointHolds(result.data, joint.end), `${letter} v${String(variant)}`).toBe(true);
        }
      }
    }
  });

  it(
    `keeps every joint of every letter closed on ${String(WORDS.length)} words × 3 variants`,
    { timeout: 60_000 },
    () => {
      for (const word of WORDS) {
        for (const variant of [0, 1, 2]) {
          const sigil = sigilOf(word, { keepVowels: false, variant });
          for (const joint of placedJoints(sigil)) {
            expect(
              jointHolds(sigil, joint.end),
              `${word} v${String(variant)} ${joint.letter} (${String(joint.end.x)}, ${String(joint.end.y)})`,
            ).toBe(true);
          }
        }
      }
    },
  );

  it('starts the leg of R on its bowl in « Victory », variant 2 (F2 regression)', () => {
    const sigil = sigilOf('Victory', { keepVowels: false, variant: 1 });
    const r = stepOf(sigil, 'spare-stem-attachments').letters.find(
      (letter) => letter.letter === 'R',
    );
    const [, bowl = [], leg = []] = r?.strokes ?? [];
    const legStart = leg[0];
    if (legStart === undefined) throw new Error('Missing leg of R');

    expect(bowl).toContainEqual(legStart);
    expect(
      sigil.strokes.some(
        (stroke) =>
          stroke.length > 2 &&
          stroke.some((point) => point.x === legStart.x && point.y === legStart.y),
      ),
    ).toBe(true);
    expect(jointHolds(sigil, legStart)).toBe(true);
  });

  it('has no marks and the 0–100 frame', () => {
    const sigil = sigilOf('Calme');
    expect(sigil.marks).toEqual([]);
    expect(sigil.viewBox).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('explains the reduction: removed letters with their reason, then C L M', () => {
    const step = stepOf(sigilOf('Calme'), 'spare-letter-reduction');

    expect(step.letters).toEqual(['C', 'A', 'L', 'M', 'E']);
    expect(step.keepVowels).toBe(false);
    expect(step.kept).toEqual(['C', 'L', 'M']);
    expect(step.removed).toEqual([
      { letter: 'A', position: 1, reason: 'vowel' },
      { letter: 'E', position: 4, reason: 'vowel' },
    ]);
  });

  it('explains the angular skeletons, before and after, inside the frame margin', () => {
    const { letters } = stepOf(sigilOf('Calme'), 'spare-angular-skeletons');

    expect(letters.map((letter) => letter.letter)).toEqual(['C', 'L', 'M']);
    for (const skeleton of letters) {
      if (!isCapitalLetter(skeleton.letter)) throw new Error('Unexpected letter');
      const angular = getAngularGlyph(skeleton.letter).strokes;
      expect(skeleton.angular).toHaveLength(angular.length);
      expect(skeleton.segmentCount).toBe(strokeSegments(skeleton.angular).length);
      for (const point of [...skeleton.glyph.flat(), ...skeleton.angular.flat()]) {
        expect(point.x).toBeGreaterThanOrEqual(FRAME_MARGIN);
        expect(point.x).toBeLessThanOrEqual(FRAME_SIZE - FRAME_MARGIN);
        expect(point.y).toBeGreaterThanOrEqual(FRAME_MARGIN);
        expect(point.y).toBeLessThanOrEqual(FRAME_SIZE - FRAME_MARGIN);
      }
    }
    // The C chevron: two segments where Hershey draws a curve of 17.
    expect(letters[0]?.segmentCount).toBe(2);
  });

  it('explains the attachments: stem, hanging order and each letter in reduction order', () => {
    const sigil = sigilOf('Amour', { keepVowels: false, variant: 1 });
    const step = stepOf(sigil, 'spare-stem-attachments');

    expect(step.stem.top.x).toBe(STEM_X);
    expect(step.stem.bottom.x).toBe(STEM_X);
    expect(step.order).toEqual(['R', 'M']);
    expect(step.letters.map((letter) => letter.letter)).toEqual(['M', 'R']);
    // Variant 1 of a short word is paired: no letter doubled, one on each side.
    expect(step.letters.map((letter) => letter.doubled)).toEqual([false, false]);
    expect(new Set(step.letters.map((letter) => letter.side))).toEqual(new Set(['left', 'right']));
    expect(step.letters.find((letter) => letter.letter === 'R')?.attachment).toBe('stem');
  });

  it('explains the choice: the lowest-penalty candidate of the variant, with its measures', () => {
    const sigil = sigilOf('Calme');
    const step = stepOf(sigil, 'spare-candidate-choice');
    const generated = generateSpareCandidates(['C', 'L', 'M'], DEFAULT_OPTIONS);
    if (!generated.ok) throw new Error('Unexpected generation error');
    const penalties = generated.data.candidates.map((candidate) => candidate.score.penalty);

    expect(step.variant).toBe(0);
    expect(step.style).toBe('symmetric');
    expect(step.candidateCount).toBe(candidateCountFor(3));
    expect(penalties[step.chosenIndex]).toBe(Math.min(...penalties));
    expect(step.score).toEqual(generated.data.candidates[step.chosenIndex]?.score);
    expect(step.score.hatches).toBe(0);
  });

  it('explains the merge with segment counts matching the sigil, never adding ink', () => {
    const sigil = sigilOf('Calme');
    const step = stepOf(sigil, 'spare-simplification');
    const { stem, letters } = stepOf(sigil, 'spare-stem-attachments');
    const unmerged = [[stem.top, stem.bottom], ...letters.flatMap((letter) => letter.strokes)];

    expect(step.segmentCountAfter).toBe(strokeSegments(sigil.strokes).length);
    expect(step.segmentCountBefore).toBe(strokeSegments(unmerged).length);
    // Letters laid on the stem are drawn once with it.
    expect(inkLength(sigil.strokes)).toBeLessThan(inkLength(unmerged));
  });

  it('proposes to keep the vowels when « oui » leaves no letter', () => {
    expect(errorOf(lettersOf('oui'))).toEqual({ code: 'NO_LETTER_LEFT', suggestKeepVowels: true });
    expect(buildSpareSigil(lettersOf('oui'), { keepVowels: true, variant: 0 }).ok).toBe(true);
  });

  it('reports no letter left, without suggestion, for an empty list', () => {
    expect(errorOf([])).toEqual({ code: 'NO_LETTER_LEFT', suggestKeepVowels: false });
  });

  it('refuses a letter outside A–Z, at its index in the given letters', () => {
    expect(errorOf(['J', 'E', 'é'])).toEqual({ code: 'INVALID_LETTER', letter: 'é', index: 2 });
  });

  it('refuses an invalid variant', () => {
    expect(errorOf(['J', 'S'], { keepVowels: false, variant: -1 })).toEqual({
      code: 'INVALID_VARIANT',
      variant: -1,
    });
  });
});
