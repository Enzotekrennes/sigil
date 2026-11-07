/**
 * End-to-end tests of the Spare sigil builder, from the typed intention:
 * determinism (D6), variants, the F2 balance criterion on a broad sample,
 * strokes inside the drawing disc and free of duplicates, no letter left in a
 * familiar orientation on the intentions refused at the first F2 acceptance
 * run, explanation steps, and business errors.
 */
import { describe, expect, it } from 'vitest';

import { normalizeIntention } from '../intention/index.ts';
import { FRAME_MARGIN, FRAME_SIZE } from '../sigil/frame.ts';
import type { ExplanationStep, Point, Sigil } from '../sigil/types.ts';
import { centreOfGravity, segmentLength, strokeSegments } from './geometry.ts';
import type { Segment } from './geometry.ts';
import { buildSpareSigil, candidateCountFor, generateSpareCandidates, spareSeed } from './index.ts';
import type { SpareError, SpareOptions } from './index.ts';
import { isCapitalLetter } from './glyphs/index.ts';
import { readsAsLetter } from './legibility.ts';
import { DRAWING_RADIUS, MAX_CENTRE_OFFSET_RATIO, chooseCandidate } from './score.ts';

/** Default settings: vowels removed, first variant. */
const DEFAULT_OPTIONS: SpareOptions = { keepVowels: false, variant: 0 };

/**
 * Distance from each other's line under which two output segments count as
 * drawn on the same line: well under the merge tolerances, so that only true
 * leftovers of a merge would match.
 */
const SAME_LINE_DISTANCE = 0.1;

/** Tolerance above the 4-decimal rounding of coordinates. */
const ROUNDING_TOLERANCE = 1e-3;

/**
 * Intentions and variants (internal numbers, the interface shows n + 1) that
 * the first F2 acceptance run found readable: a C, an A (an upside-down V or
 * M) could be picked out. Kept with their neighbours as a regression set.
 */
const REFUSED_CASES: readonly (readonly [string, number])[] = [
  ...[0, 1, 2, 3, 4].map((variant) => ['I am strong', variant] as const),
  ...[0, 1, 2, 3, 4].map((variant) => ['Je suis calme', variant] as const),
  ['Je trouve ma voie', 0],
  ['Je trouve ma voie', 1],
  ['La paix est en moi', 0],
];

/**
 * Letters that read as a letter in every orientation (see `readsAsLetter`):
 * no draw can avoid them, so the regression test leaves them out.
 */
const ALWAYS_LETTER_LIKE: ReadonlySet<string> = new Set(['C', 'N', 'O', 'Q', 'U', 'X', 'Z']);

/** Overlap beyond which two segments on the same line count as drawn twice. */
const MAX_OVERLAP = 0.5;

/** Intentions in French and English, short and long, to sample the method. */
const INTENTIONS: readonly string[] = [
  'Je suis calme',
  'I am strong',
  'Je trouve ma voie',
  'My mind is clear',
  'Je suis libre',
  'I sleep deeply',
  'La paix est en moi',
  'I attract abundance',
  'Je guéris chaque jour',
  "J'ai confiance en moi",
  'I am loved',
  'Je réussis mon examen',
  'My body is healthy',
  'Je dors profondément',
  'I forgive myself',
  'Mon cœur est ouvert',
  'I am enough',
  'Je mérite le bonheur',
  'Wealth flows to me',
  'Je suis protégé',
  'I trust the process',
  'Je rayonne',
  'My work is valued',
  'Je trouve un travail',
  'I speak with confidence',
  'Ma famille est unie',
  'I let go of fear',
  'Je suis en sécurité',
  'Every day I grow',
  'Je crée librement',
  'I am grateful',
  'Mon esprit est vif',
  'Love surrounds me',
  'Je voyage loin',
  'I choose joy',
  'Je suis patient',
  'My home is peaceful',
  'Je gagne en force',
  'I am at peace',
  'Je prends soin de moi',
  'Success comes easily',
  'Je suis aimé',
  'I welcome change',
  'Je respire calmement',
  'Courage',
  'Je vis pleinement',
  'My voice matters',
  'Je suis serein',
  'I honour my path',
  'Le succès vient à moi',
  'Zéphyr',
  'Quietly brave',
];

/**
 * Normalises an intention, failing the test if it has no letter.
 *
 * @param text - Intention as typed.
 * @returns Its normalised letters.
 */
function lettersOf(text: string): string[] {
  const result = normalizeIntention(text);
  if (!result.ok) throw new Error(`Unexpected normalisation error ${result.error}`);
  return result.intention.letters;
}

/**
 * Builds the sigil of an intention, failing the test on a business error.
 *
 * @param text - Intention as typed.
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
 * Length over which two segments lying on the same line overlap.
 *
 * @param a - First segment, of positive length.
 * @param b - Second segment.
 * @returns The overlap length, or 0 when they are not on the same line.
 */
function collinearOverlap(a: Segment, b: Segment): number {
  const length = segmentLength(a);
  const ux = (a.end.x - a.start.x) / length;
  const uy = (a.end.y - a.start.y) / length;
  const across = (point: Point): number =>
    Math.abs((point.x - a.start.x) * uy - (point.y - a.start.y) * ux);
  if (across(b.start) > SAME_LINE_DISTANCE || across(b.end) > SAME_LINE_DISTANCE) return 0;
  const along = (point: Point): number => (point.x - a.start.x) * ux + (point.y - a.start.y) * uy;
  const from = Math.max(0, Math.min(along(b.start), along(b.end)));
  const to = Math.min(length, Math.max(along(b.start), along(b.end)));
  return Math.max(0, to - from);
}

describe('buildSpareSigil', () => {
  it('gives the same sigil for the same intention and settings, seeded by D6', () => {
    const first = sigilOf('Je suis calme');

    expect(sigilOf('Je suis calme')).toEqual(first);
    expect(first.seed).toBe(spareSeed({ letters: ['J', 'S', 'C', 'L', 'M'], ...DEFAULT_OPTIONS }));
  });

  it('gives the same sigil for « je suis calme ! » as for « Je suis calme »', () => {
    expect(sigilOf('je suis calme !')).toEqual(sigilOf('Je suis calme'));
  });

  it('gives each variant number a stable sigil, different from the next one', () => {
    for (let variant = 0; variant < 5; variant += 1) {
      const current = sigilOf('Je suis calme', { keepVowels: false, variant });
      const next = sigilOf('Je suis calme', { keepVowels: false, variant: variant + 1 });

      expect(sigilOf('Je suis calme', { keepVowels: false, variant })).toEqual(current);
      expect(next.strokes).not.toEqual(current.strokes);
      expect(next.seed).not.toBe(current.seed);
    }
  });

  it(`meets the F2 criteria on ${String(INTENTIONS.length)} intentions × 3 variants`, () => {
    expect(INTENTIONS.length).toBeGreaterThanOrEqual(50);
    for (const text of INTENTIONS) {
      for (let variant = 0; variant < 3; variant += 1) {
        const sigil = sigilOf(text, { keepVowels: false, variant });
        const segments = strokeSegments(sigil.strokes);
        const centre = centreOfGravity(segments);
        if (centre === undefined) throw new Error(`Empty sigil for ${text}`);

        // Centre of gravity within 10 % of the side from the frame centre.
        const offset = Math.hypot(centre.x - FRAME_SIZE / 2, centre.y - FRAME_SIZE / 2);
        expect(offset / FRAME_SIZE).toBeLessThan(MAX_CENTRE_OFFSET_RATIO);

        // Every point inside the drawing disc, hence inside the frame's margin
        // and the framing circle.
        for (const point of sigil.strokes.flat()) {
          const radius = Math.hypot(point.x - FRAME_SIZE / 2, point.y - FRAME_SIZE / 2);
          expect(radius).toBeLessThanOrEqual(DRAWING_RADIUS + ROUNDING_TOLERANCE);
          expect(point.x).toBeGreaterThanOrEqual(FRAME_MARGIN);
          expect(point.x).toBeLessThanOrEqual(FRAME_SIZE - FRAME_MARGIN);
          expect(point.y).toBeGreaterThanOrEqual(FRAME_MARGIN);
          expect(point.y).toBeLessThanOrEqual(FRAME_SIZE - FRAME_MARGIN);
        }

        // Valid polylines: at least two points, no zero-length segment.
        for (const stroke of sigil.strokes) expect(stroke.length).toBeGreaterThanOrEqual(2);
        for (const segment of segments) expect(segmentLength(segment)).toBeGreaterThan(0);

        // No segment drawn twice, even partly, after simplification.
        segments.forEach((segment, index) => {
          for (const other of segments.slice(index + 1)) {
            expect(collinearOverlap(segment, other)).toBeLessThanOrEqual(MAX_OVERLAP);
          }
        });
      }
    }
  });

  it.each(REFUSED_CASES)(
    'leaves no letter of « %s » (variant %i) upright or upside down when it can be avoided',
    (text, variant) => {
      const { letters } = stepOf(
        sigilOf(text, { keepVowels: false, variant }),
        'spare-letter-placements',
      );
      const familiar = letters.filter(
        (placement) =>
          isCapitalLetter(placement.letter) &&
          !ALWAYS_LETTER_LIKE.has(placement.letter) &&
          readsAsLetter(placement.letter, placement.rotation),
      );
      expect(
        familiar.map((placement) => `${placement.letter}${String(placement.rotation)}`),
      ).toEqual([]);
    },
  );

  it('has no marks and the 0–100 frame', () => {
    const sigil = sigilOf('Je suis calme');
    expect(sigil.marks).toEqual([]);
    expect(sigil.viewBox).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('explains the reduction: removed letters with their reason, then J S C L M', () => {
    const step = stepOf(sigilOf('Je suis calme'), 'spare-letter-reduction');

    expect(step.letters).toEqual(lettersOf('Je suis calme'));
    expect(step.keepVowels).toBe(false);
    expect(step.kept).toEqual(['J', 'S', 'C', 'L', 'M']);
    expect(step.removed).toEqual([
      { letter: 'E', position: 1, reason: 'vowel' },
      { letter: 'U', position: 3, reason: 'vowel' },
      { letter: 'I', position: 4, reason: 'vowel' },
      { letter: 'S', position: 5, reason: 'duplicate' },
      { letter: 'A', position: 7, reason: 'vowel' },
      { letter: 'E', position: 10, reason: 'duplicate' },
    ]);
  });

  it('explains each letter: transforms, upright skeleton and placed strokes in the frame', () => {
    const sigil = sigilOf('Je suis calme');
    const { letters } = stepOf(sigil, 'spare-letter-placements');

    expect(letters.map((letter) => letter.letter)).toEqual(['J', 'S', 'C', 'L', 'M']);
    for (const letter of letters) {
      expect([0, 90, 180, 270]).toContain(letter.rotation);
      expect(letter.glyph.length).toBeGreaterThan(0);
      expect(letter.strokes.length).toBeGreaterThan(0);
      for (const point of [...letter.glyph.flat(), ...letter.strokes.flat()]) {
        expect(point.x).toBeGreaterThanOrEqual(FRAME_MARGIN);
        expect(point.x).toBeLessThanOrEqual(FRAME_SIZE - FRAME_MARGIN);
        expect(point.y).toBeGreaterThanOrEqual(FRAME_MARGIN);
        expect(point.y).toBeLessThanOrEqual(FRAME_SIZE - FRAME_MARGIN);
      }
    }
  });

  it('explains the choice: the lowest-penalty candidate of the seed', () => {
    const sigil = sigilOf('Je suis calme');
    const step = stepOf(sigil, 'spare-candidate-choice');
    const generated = generateSpareCandidates(['J', 'S', 'C', 'L', 'M'], DEFAULT_OPTIONS);
    if (!generated.ok) throw new Error('Unexpected generation error');
    const { index, scores } = chooseCandidate(generated.data.candidates);

    expect(step.candidateCount).toBe(candidateCountFor(5));
    expect(step.chosenIndex).toBe(index);
    expect(step.penalty).toBe(Math.min(...scores.map((score) => score.penalty)));
    expect(step.centreOffset).toBeGreaterThanOrEqual(0);
    expect(step.fill).toBeGreaterThan(0);
    expect(step.fill).toBeLessThanOrEqual(1);
  });

  it('explains the simplification with segment counts matching the sigil', () => {
    const sigil = sigilOf('Je suis calme');
    const step = stepOf(sigil, 'spare-simplification');

    expect(step.segmentCountAfter).toBe(strokeSegments(sigil.strokes).length);
    expect(step.segmentCountAfter).toBeLessThanOrEqual(step.segmentCountBefore);
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
