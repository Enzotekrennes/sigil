/**
 * Unit tests of the Spare balance score and recentring: each term measured
 * on hand-made compositions, the weighted total, the choice of the best
 * candidate, and the recentring on the centre of gravity within the margin.
 */
import { describe, expect, it } from 'vitest';

import { FRAME_MARGIN, FRAME_SIZE } from '../sigil/frame.ts';
import type { Point } from '../sigil/types.ts';
import type { SpareCandidate } from './generateSpareCandidates.ts';
import { centreOfGravity, strokeSegments } from './geometry.ts';
import type { CapitalLetter } from './glyphs/index.ts';
import type { QuarterTurn } from './placement.ts';
import {
  BALANCE_WEIGHT,
  FILL_WEIGHT,
  ISOLATION_WEIGHT,
  MAX_CENTRE_OFFSET_RATIO,
  UPRIGHT_WEIGHT,
  applyRecentring,
  chooseCandidate,
  recentringFor,
  scoreCandidate,
} from './score.ts';

/** Tolerance on computed values. */
const EPSILON = 1e-9;

/** Letter stroke of a hand-made candidate: owner letter, orientation, polyline. */
interface TestLetter {
  readonly letter: CapitalLetter;
  readonly mirrored?: boolean;
  readonly rotation?: QuarterTurn;
  readonly strokes: readonly (readonly Point[])[];
}

/**
 * Builds a candidate from letters drawn by hand. Orientation defaults to a
 * quarter turn, which never leaves a letter upright.
 *
 * @param letters - Letters with their strokes in the 0–100 frame.
 * @returns The candidate, strokes letter by letter.
 */
function candidateOf(letters: readonly TestLetter[]): SpareCandidate {
  return {
    strokes: letters.flatMap((letter) => letter.strokes),
    strokeLetters: letters.flatMap((letter, index) => letter.strokes.map(() => index)),
    placements: letters.map((letter) => ({
      letter: letter.letter,
      mirrored: letter.mirrored ?? false,
      rotation: letter.rotation ?? 90,
      scale: 1,
      offset: { x: 0, y: 0 },
      sharedStemWith: null,
    })),
  };
}

/** A cross centred on the frame, spanning the drawing area: perfectly balanced, filling it. */
const CENTRED_CROSS = candidateOf([
  {
    letter: 'L',
    strokes: [
      [
        { x: 10, y: 50 },
        { x: 90, y: 50 },
      ],
    ],
  },
  {
    letter: 'T',
    strokes: [
      [
        { x: 50, y: 10 },
        { x: 50, y: 90 },
      ],
    ],
  },
]);

describe('scoreCandidate', () => {
  it('gives no penalty to a centred, filling, connected, turned composition', () => {
    expect(scoreCandidate(CENTRED_CROSS)).toEqual({
      centreOffset: 0,
      fill: 1,
      isolatedLetters: [],
      uprightLetters: [],
      penalty: 0,
    });
  });

  it('measures the offset of the centre of gravity as a fraction of the frame side', () => {
    // An L whose long stem pulls the ink to the left of its box centre (50, 50).
    const candidate = candidateOf([
      {
        letter: 'L',
        strokes: [
          [
            { x: 10, y: 10 },
            { x: 10, y: 90 },
            { x: 90, y: 90 },
          ],
        ],
      },
    ]);
    // Midpoints (10, 50) and (50, 90), equal lengths: centre of gravity (30, 70).
    const expected = Math.hypot(20, 20) / FRAME_SIZE;
    expect(scoreCandidate(candidate).centreOffset).toBeCloseTo(expected, 9);
  });

  it('measures fill on the recentred box, so a stretched drawing fills little', () => {
    const flat = candidateOf([
      {
        letter: 'L',
        strokes: [
          [
            { x: 10, y: 45 },
            { x: 90, y: 45 },
            { x: 90, y: 55 },
          ],
        ],
      },
    ]);
    const { fill } = scoreCandidate(flat);
    expect(fill).toBeGreaterThan(0);
    expect(fill).toBeLessThan(0.15);
  });

  it('lists the letters touching no other letter', () => {
    const candidate = candidateOf([
      ...[
        { letter: 'L' as const, strokes: CENTRED_CROSS.strokes.slice(0, 1) },
        { letter: 'T' as const, strokes: CENTRED_CROSS.strokes.slice(1, 2) },
      ],
      {
        letter: 'K',
        strokes: [
          [
            { x: 80, y: 80 },
            { x: 90, y: 90 },
          ],
        ],
      },
    ]);
    expect(scoreCandidate(candidate).isolatedLetters).toEqual([2]);
  });

  it('counts letters as touching when their strokes merely meet', () => {
    const candidate = candidateOf([
      {
        letter: 'L',
        strokes: [
          [
            { x: 10, y: 10 },
            { x: 50, y: 10 },
          ],
        ],
      },
      {
        letter: 'T',
        strokes: [
          [
            { x: 50, y: 10 },
            { x: 90, y: 90 },
          ],
        ],
      },
    ]);
    expect(scoreCandidate(candidate).isolatedLetters).toEqual([]);
  });

  it('never isolates a lone letter, which has nothing to touch', () => {
    const lone = candidateOf([{ letter: 'L', strokes: CENTRED_CROSS.strokes }]);
    expect(scoreCandidate(lone).isolatedLetters).toEqual([]);
  });

  it('lists the letters left as written, upright or by symmetry', () => {
    const candidate = candidateOf([
      { letter: 'L', rotation: 0, strokes: CENTRED_CROSS.strokes.slice(0, 1) },
      { letter: 'T', mirrored: true, rotation: 0, strokes: CENTRED_CROSS.strokes.slice(1, 2) },
    ]);
    // L upright is readable; T reversed is still a T.
    expect(scoreCandidate(candidate).uprightLetters).toEqual([0, 1]);
  });

  it('adds the weighted terms into the penalty', () => {
    const candidate = candidateOf([
      {
        letter: 'L',
        rotation: 0,
        strokes: [
          [
            { x: 10, y: 10 },
            { x: 10, y: 90 },
            { x: 90, y: 90 },
          ],
        ],
      },
      {
        letter: 'K',
        strokes: [
          [
            { x: 60, y: 20 },
            { x: 80, y: 40 },
          ],
        ],
      },
    ]);
    const score = scoreCandidate(candidate);
    const expected =
      (BALANCE_WEIGHT * score.centreOffset) / MAX_CENTRE_OFFSET_RATIO +
      FILL_WEIGHT * (1 - score.fill) +
      (ISOLATION_WEIGHT * 2) / 2 +
      (UPRIGHT_WEIGHT * 1) / 2;

    expect(score.isolatedLetters).toEqual([0, 1]);
    expect(score.uprightLetters).toEqual([0]);
    expect(score.penalty).toBeCloseTo(expected, 9);
  });
});

describe('chooseCandidate', () => {
  const unbalanced = candidateOf([
    {
      letter: 'L',
      strokes: [
        [
          { x: 10, y: 10 },
          { x: 10, y: 90 },
          { x: 90, y: 90 },
        ],
      ],
    },
  ]);

  it('picks the lowest penalty', () => {
    const { index, scores } = chooseCandidate([unbalanced, CENTRED_CROSS, unbalanced]);
    expect(index).toBe(1);
    expect(scores).toHaveLength(3);
  });

  it('picks the first of equal candidates', () => {
    expect(chooseCandidate([unbalanced, unbalanced]).index).toBe(0);
  });

  it('refuses an empty list', () => {
    expect(() => chooseCandidate([])).toThrow(RangeError);
  });
});

describe('recentringFor and applyRecentring', () => {
  const strokes = [
    [
      { x: 10, y: 10 },
      { x: 10, y: 90 },
      { x: 90, y: 90 },
    ],
  ];

  it('puts the centre of gravity on the frame centre, at the largest size within the margin', () => {
    const moved = applyRecentring(strokes, recentringFor(strokes, strokes.flat()));
    const centre = centreOfGravity(strokeSegments(moved));
    const reach = Math.max(
      ...moved.flat().flatMap((point) => [Math.abs(point.x - 50), Math.abs(point.y - 50)]),
    );

    expect(centre?.x).toBeCloseTo(50, 3);
    expect(centre?.y).toBeCloseTo(50, 3);
    expect(reach).toBeCloseTo(50 - FRAME_MARGIN, 9);
  });

  it('keeps the whole envelope within the margin, not only the strokes', () => {
    const envelope = [...strokes.flat(), { x: 95, y: 5 }];
    const moved = applyRecentring([envelope], recentringFor(strokes, envelope));
    for (const point of moved.flat()) {
      expect(point.x).toBeGreaterThanOrEqual(FRAME_MARGIN - EPSILON);
      expect(point.x).toBeLessThanOrEqual(FRAME_SIZE - FRAME_MARGIN + EPSILON);
      expect(point.y).toBeGreaterThanOrEqual(FRAME_MARGIN - EPSILON);
      expect(point.y).toBeLessThanOrEqual(FRAME_SIZE - FRAME_MARGIN + EPSILON);
    }
  });
});
