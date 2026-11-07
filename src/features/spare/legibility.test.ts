/**
 * Unit tests of the legibility measure of Spare letters: entanglement on
 * hand-made compositions (apart, crossed, running along), the orientations
 * that still read as a letter, the deficit derived from both, and the
 * one- and two-letter intentions the criterion does not apply to.
 */
import { describe, expect, it } from 'vitest';

import type { Point } from '../sigil/types.ts';
import type { SpareCandidate } from './generateSpareCandidates.ts';
import type { CapitalLetter } from './glyphs/index.ts';
import {
  ENTANGLEMENT_DISTANCE,
  LETTER_LIKE_BASE_DEFICIT,
  MIN_ENTANGLEMENT,
  letterLegibility,
  readsAsLetter,
  readsInAnyOrientation,
} from './legibility.ts';
import type { QuarterTurn } from './placement.ts';

/** Tolerance on shares measured by sampling every frame unit. */
const SAMPLING_TOLERANCE = 0.05;

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

describe('letterLegibility', () => {
  it('finds no entanglement between letters drawn apart', () => {
    const [left, right] = letterLegibility(
      candidateOf([
        { letter: 'L', strokes: [line(10, 10, 10, 90)] },
        { letter: 'T', strokes: [line(60, 10, 60, 90)] },
      ]),
    );
    expect(left?.entanglement).toBe(0);
    expect(right?.entanglement).toBe(0);
    expect(left?.deficit).toBe(1);
  });

  it('counts a stroke running alongside another letter as fully tangled', () => {
    const [first, second] = letterLegibility(
      candidateOf([
        { letter: 'L', strokes: [line(10, 50, 90, 50)] },
        { letter: 'T', strokes: [line(10, 50 + ENTANGLEMENT_DISTANCE / 2, 90, 52)] },
      ]),
    );
    expect(first?.entanglement).toBe(1);
    expect(second?.entanglement).toBe(1);
    expect(first?.deficit).toBe(0);
  });

  it('counts only the stretch near a crossing: a crossed letter stays readable', () => {
    // A vertical stroke 80 long, crossed once at right angles: about 2 × 3 of
    // its length lies within the entanglement distance.
    const [crossed] = letterLegibility(
      candidateOf([
        { letter: 'L', strokes: [line(50, 10, 50, 90)] },
        { letter: 'T', strokes: [line(10, 50, 90, 50)] },
      ]),
    );
    const expected = (2 * ENTANGLEMENT_DISTANCE) / 80;
    expect(crossed?.entanglement).toBeCloseTo(expected, 1);
    expect(crossed?.deficit).toBeGreaterThan(0.8);
  });

  it('measures the tangled share of a partly covered letter', () => {
    // Half of the L runs along the T.
    const [half] = letterLegibility(
      candidateOf([
        { letter: 'L', strokes: [line(10, 50, 90, 50)] },
        { letter: 'T', strokes: [line(10, 51, 50, 51)] },
      ]),
    );
    expect(Math.abs((half?.entanglement ?? 0) - 0.5)).toBeLessThan(SAMPLING_TOLERANCE);
  });

  it('gives a turned letter a deficit proportional to its shortfall', () => {
    // A quarter of the L tangled: half the required share.
    const [letter] = letterLegibility(
      candidateOf([
        { letter: 'L', strokes: [line(10, 50, 90, 50)] },
        { letter: 'T', strokes: [line(10, 51, 30, 51)] },
      ]),
    );
    const expected = (MIN_ENTANGLEMENT - (letter?.entanglement ?? 0)) / MIN_ENTANGLEMENT;
    expect(letter?.readsAsLetter).toBe(false);
    expect(letter?.deficit).toBeCloseTo(expected, 9);
  });

  it('never clears a letter left in a familiar orientation, however tangled', () => {
    const [upright] = letterLegibility(
      candidateOf([
        { letter: 'L', rotation: 0, strokes: [line(10, 50, 90, 50)] },
        { letter: 'T', strokes: [line(10, 51, 90, 51)] },
      ]),
    );
    expect(upright?.entanglement).toBe(1);
    expect(upright?.readsAsLetter).toBe(true);
    expect(upright?.deficit).toBe(LETTER_LIKE_BASE_DEFICIT);
  });

  it('counts a familiar letter tangled no more than a turned one needs as wholly visible', () => {
    // Upright L with half its length tangled: the extra part of its deficit is full.
    const [upright] = letterLegibility(
      candidateOf([
        { letter: 'L', rotation: 0, strokes: [line(10, 50, 90, 50)] },
        { letter: 'T', strokes: [line(10, 51, 50, 51)] },
      ]),
    );
    expect(upright?.entanglement ?? 1).toBeLessThanOrEqual(MIN_ENTANGLEMENT + SAMPLING_TOLERANCE);
    expect(upright?.deficit ?? 0).toBeGreaterThan(0.9);
  });

  it('does not apply to a single letter, which has nothing to tangle with', () => {
    const [alone] = letterLegibility(
      candidateOf([{ letter: 'K', strokes: [line(10, 10, 90, 90)] }]),
    );
    expect(alone?.deficit).toBe(0);
  });

  it('still measures two letters, though two cannot hide each other entirely', () => {
    // « Yeux » keeps Y and X only: the criterion is not required of it, the
    // measure is still computed so that the score prefers the more tangled pair.
    const legibility = letterLegibility(
      candidateOf([
        { letter: 'Y', strokes: [line(10, 10, 90, 90)] },
        { letter: 'K', strokes: [line(10, 90, 90, 10)] },
      ]),
    );
    expect(legibility).toHaveLength(2);
    for (const letter of legibility) expect(letter.entanglement).toBeGreaterThan(0);
  });
});

describe('readsAsLetter', () => {
  it('reads every letter upright or upside down, mirrored or not', () => {
    for (const letter of ['A', 'M', 'R', 'S', 'V'] as const) {
      expect(readsAsLetter(letter, 0)).toBe(true);
      expect(readsAsLetter(letter, 180)).toBe(true);
    }
  });

  it('does not read most letters laid on their side', () => {
    for (const letter of ['A', 'E', 'K', 'M', 'R', 'S', 'V'] as const) {
      expect(readsAsLetter(letter, 90)).toBe(false);
      expect(readsAsLetter(letter, 270)).toBe(false);
    }
  });

  it('reads the letters a quarter turn turns into letters again', () => {
    for (const letter of ['C', 'N', 'O', 'Q', 'U', 'X', 'Z'] as const) {
      expect(readsAsLetter(letter, 90)).toBe(true);
      expect(readsAsLetter(letter, 270)).toBe(true);
      expect(readsInAnyOrientation(letter)).toBe(true);
    }
    for (const letter of ['A', 'J', 'L', 'M', 'S'] as const) {
      expect(readsInAnyOrientation(letter)).toBe(false);
    }
  });
});
