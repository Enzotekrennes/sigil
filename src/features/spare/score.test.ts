/**
 * Unit tests of the Spare balance score and recentring: each term measured
 * on hand-made compositions, the weighted total, the choice of the best
 * candidate, the isolated letters reported to the panel, and the recentring
 * on the centre of gravity inside the drawing disc.
 */
import { describe, expect, it } from 'vitest';

import { FRAME_SIZE } from '../sigil/frame.ts';
import type { Point } from '../sigil/types.ts';
import type { SpareCandidate } from './generateSpareCandidates.ts';
import { centreOfGravity, strokeSegments } from './geometry.ts';
import type { CapitalLetter } from './glyphs/index.ts';
import type { QuarterTurn } from './placement.ts';
import {
  BALANCE_WEIGHT,
  DRAWING_RADIUS,
  ELONGATION_WEIGHT,
  FILL_WEIGHT,
  LEGIBILITY_WEIGHT,
  MAX_CENTRE_OFFSET_RATIO,
  MIN_SPREAD,
  SHRINK_WEIGHT,
  applyRecentring,
  chooseCandidate,
  findIsolatedLetters,
  recentringFor,
  scoreCandidate,
} from './score.ts';

/** Tolerance above the 4-decimal rounding of recentred coordinates. */
const ROUNDING_TOLERANCE = 1e-3;

/** Centre of the frame. */
const CENTRE: Point = { x: FRAME_SIZE / 2, y: FRAME_SIZE / 2 };

/** A hand-drawn letter of a test candidate. */
interface TestLetter {
  readonly letter: CapitalLetter;
  readonly rotation?: QuarterTurn;
  readonly strokes: readonly (readonly Point[])[];
}

/**
 * Builds a candidate from letters drawn by hand. The rotation defaults to a
 * quarter turn, which leaves the test letters (L, T, K, M) unfamiliar.
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
      mirrored: false,
      rotation: letter.rotation ?? 90,
      scale: 1,
      offset: { x: 0, y: 0 },
      sharedStemWith: null,
    })),
  };
}

/**
 * Shorthand for a two-point stroke.
 *
 * @param x1 - Start abscissa.
 * @param y1 - Start ordinate.
 * @param x2 - End abscissa.
 * @param y2 - End ordinate.
 * @returns The stroke.
 */
function line(x1: number, y1: number, x2: number, y2: number): Point[] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
  ];
}

/** An L whose long stem pulls the ink to the left of its box centre (50, 50). */
const LONE_L = candidateOf([
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

/** Two letters drawn on the same square, one inside the other: fully tangled, centred. */
const TANGLED_PAIR = candidateOf([
  {
    letter: 'L',
    strokes: [line(20, 20, 80, 20), line(80, 20, 80, 80), line(80, 80, 20, 80)],
  },
  {
    letter: 'T',
    strokes: [
      line(20, 21, 80, 21),
      line(79, 20, 79, 80),
      line(80, 79, 20, 79),
      line(20, 80, 20, 20),
    ],
  },
]);

describe('scoreCandidate', () => {
  it('measures the offset of the centre of gravity as a fraction of the frame side', () => {
    // Midpoints (10, 50) and (50, 90), equal lengths: centre of gravity (30, 70).
    const expected = Math.hypot(20, 20) / FRAME_SIZE;
    expect(scoreCandidate(LONE_L).centreOffset).toBeCloseTo(expected, 9);
  });

  it('measures fill on the recentred box, so a stretched drawing fills little', () => {
    const flat = candidateOf([
      { letter: 'L', strokes: [line(10, 45, 90, 45), line(90, 45, 90, 55)] },
    ]);
    const { fill } = scoreCandidate(flat);
    expect(fill).toBeGreaterThan(0);
    expect(fill).toBeLessThan(0.15);
  });

  it('measures the spread of the ink, low for a small knot with a long tail', () => {
    // Six small squares 10 wide around (45, 50), and one stroke 35 long sticking out.
    const knotStrokes = Array.from({ length: 6 }, (_, ring) => {
      const half = 3 + ring / 2;
      return [
        { x: 45 - half, y: 50 - half },
        { x: 45 + half, y: 50 - half },
        { x: 45 + half, y: 50 + half },
        { x: 45 - half, y: 50 + half },
        { x: 45 - half, y: 50 - half },
      ];
    });
    const knot = candidateOf([{ letter: 'K', strokes: [...knotStrokes, line(50, 50, 85, 50)] }]);
    const square = candidateOf([
      { letter: 'L', strokes: [line(10, 10, 90, 10), line(90, 10, 90, 90), line(90, 90, 10, 90)] },
    ]);

    expect(scoreCandidate(knot).spread).toBeLessThan(MIN_SPREAD);
    expect(scoreCandidate(square).spread).toBeGreaterThan(MIN_SPREAD);
  });

  it('measures the elongation of the box, the same for a wide and a tall drawing', () => {
    const wide = candidateOf([
      { letter: 'L', strokes: [line(10, 40, 90, 40), line(90, 40, 90, 60)] },
    ]);
    const tall = candidateOf([
      { letter: 'L', strokes: [line(40, 10, 40, 90), line(40, 90, 60, 90)] },
    ]);

    expect(scoreCandidate(wide).elongation).toBeCloseTo(4, 9);
    expect(scoreCandidate(tall).elongation).toBeCloseTo(4, 9);
    expect(scoreCandidate(TANGLED_PAIR).elongation).toBeCloseTo(1, 9);
  });

  it('keeps the elongation finite for a drawing without thickness', () => {
    const flat = candidateOf([{ letter: 'L', strokes: [line(10, 50, 90, 50)] }]);
    const { elongation, penalty } = scoreCandidate(flat);
    expect(Number.isFinite(elongation)).toBe(true);
    expect(elongation).toBeGreaterThan(10);
    expect(Number.isFinite(penalty)).toBe(true);
  });

  it('prefers a square composition to an equally legible flat one', () => {
    const square = candidateOf([
      { letter: 'L', strokes: [line(20, 20, 80, 20), line(80, 20, 80, 80), line(80, 80, 20, 80)] },
    ]);
    const flat = candidateOf([
      { letter: 'L', strokes: [line(10, 40, 90, 40), line(90, 40, 90, 60), line(90, 60, 10, 60)] },
    ]);
    expect(chooseCandidate([flat, square]).index).toBe(1);
  });

  it('rates the legibility of every letter', () => {
    const { legibility } = scoreCandidate(TANGLED_PAIR);
    expect(legibility).toHaveLength(2);
    for (const letter of legibility) expect(letter.deficit).toBe(0);
  });

  it('adds the weighted terms into the penalty', () => {
    const candidate = candidateOf([
      { letter: 'L', rotation: 0, strokes: LONE_L.strokes },
      { letter: 'K', strokes: [line(60, 20, 80, 40)] },
    ]);
    const score = scoreCandidate(candidate);
    const deficits = score.legibility.reduce((sum, letter) => sum + letter.deficit, 0);
    const expected =
      (BALANCE_WEIGHT * score.centreOffset) / MAX_CENTRE_OFFSET_RATIO +
      FILL_WEIGHT * (1 - score.fill) +
      (SHRINK_WEIGHT * Math.max(0, MIN_SPREAD - score.spread)) / MIN_SPREAD +
      LEGIBILITY_WEIGHT * deficits +
      ELONGATION_WEIGHT * (score.elongation - 1);

    // Both letters stand apart: the upright L and the turned K are fully readable.
    expect(score.legibility.map((letter) => letter.deficit)).toEqual([1, 1]);
    expect(score.penalty).toBeCloseTo(expected, 9);
  });

  it('makes a readable letter cost more than any balance or fill difference', () => {
    const separated = candidateOf([
      { letter: 'L', strokes: [line(10, 10, 10, 90), line(10, 90, 40, 90)] },
      { letter: 'T', strokes: [line(60, 10, 90, 10), line(75, 10, 75, 90)] },
    ]);
    expect(scoreCandidate(separated).penalty).toBeGreaterThan(
      scoreCandidate(TANGLED_PAIR).penalty + 2,
    );
  });
});

describe('chooseCandidate', () => {
  it('picks the lowest penalty', () => {
    const { index, scores } = chooseCandidate([LONE_L, TANGLED_PAIR, LONE_L]);
    expect(index).toBe(1);
    expect(scores).toHaveLength(3);
  });

  it('picks the first of equal candidates', () => {
    expect(chooseCandidate([LONE_L, LONE_L]).index).toBe(0);
  });

  it('refuses an empty list', () => {
    expect(() => chooseCandidate([])).toThrow(RangeError);
  });
});

describe('findIsolatedLetters', () => {
  it('lists the letters touching no other letter', () => {
    const candidate = candidateOf([
      { letter: 'L', strokes: [line(10, 50, 90, 50)] },
      { letter: 'T', strokes: [line(50, 10, 50, 90)] },
      { letter: 'K', strokes: [line(80, 80, 90, 90)] },
    ]);
    expect(findIsolatedLetters(candidate)).toEqual([2]);
  });

  it('counts letters as touching when their strokes merely meet', () => {
    const candidate = candidateOf([
      { letter: 'L', strokes: [line(10, 10, 50, 10)] },
      { letter: 'T', strokes: [line(50, 10, 90, 90)] },
    ]);
    expect(findIsolatedLetters(candidate)).toEqual([]);
  });

  it('never isolates a lone letter, which has nothing to touch', () => {
    expect(findIsolatedLetters(LONE_L)).toEqual([]);
  });
});

describe('recentringFor and applyRecentring', () => {
  const strokes = LONE_L.strokes;

  it('puts the centre of gravity on the frame centre, the farthest point on the drawing disc', () => {
    const moved = applyRecentring(strokes, recentringFor(strokes, strokes.flat()));
    const centre = centreOfGravity(strokeSegments(moved));
    const reach = Math.max(
      ...moved.flat().map((point) => Math.hypot(point.x - CENTRE.x, point.y - CENTRE.y)),
    );

    expect(centre?.x).toBeCloseTo(CENTRE.x, 3);
    expect(centre?.y).toBeCloseTo(CENTRE.y, 3);
    expect(reach).toBeCloseTo(DRAWING_RADIUS, 3);
  });

  it('keeps the whole envelope inside the drawing disc, not only the strokes', () => {
    const envelope = [...strokes.flat(), { x: 95, y: 5 }];
    const moved = applyRecentring([envelope], recentringFor(strokes, envelope));
    for (const point of moved.flat()) {
      expect(Math.hypot(point.x - CENTRE.x, point.y - CENTRE.y)).toBeLessThanOrEqual(
        DRAWING_RADIUS + ROUNDING_TOLERANCE,
      );
    }
  });
});
