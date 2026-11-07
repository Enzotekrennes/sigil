/**
 * Unit tests of the step-by-step replay: number of steps per method, the part
 * of the path drawn after each step, and when each mark shows.
 */
import { describe, expect, it } from 'vitest';

import { buildKameaSigil } from '../kamea/index.ts';
import { revealSteps, stepwiseStepCount } from './stepwise.ts';
import type { Sigil } from './types.ts';

/**
 * Builds a kamea sigil on Saturn and fails the test if the builder refused.
 *
 * @param letters - Normalised letters.
 * @returns The sigil.
 */
function saturn(letters: readonly string[]): Sigil {
  const result = buildKameaSigil(letters, 'saturn');
  if (!result.ok) throw new Error(`Unexpected kamea error ${result.error.code}`);
  return result.data;
}

/** A Spare-like sigil: three separate strokes, no marks. */
const THREE_STROKES: Sigil = {
  strokes: [
    [
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 30, y: 10 },
    ],
    [
      { x: 10, y: 50 },
      { x: 50, y: 50 },
    ],
    [
      { x: 10, y: 90 },
      { x: 90, y: 90 },
    ],
  ],
  marks: [],
  viewBox: { x: 0, y: 0, width: 100, height: 100 },
  steps: [],
  seed: 1,
};

describe('stepwiseStepCount', () => {
  it('counts one step per segment of a single-stroke kamea path', () => {
    // J E S U I S C A L M E on Saturn: 11 cells, no repetition in a row, so 10 segments.
    const sigil = saturn(['J', 'E', 'S', 'U', 'I', 'S', 'C', 'A', 'L', 'M', 'E']);

    expect(stepwiseStepCount(sigil)).toBe((sigil.strokes[0]?.length ?? 0) - 1);
    expect(stepwiseStepCount(sigil)).toBe(10);
  });

  it('counts one step per stroke of a multi-stroke sigil', () => {
    expect(stepwiseStepCount(THREE_STROKES)).toBe(3);
  });
});

describe('revealSteps', () => {
  it('draws the start circle and the first segment at step 1, the end bar only at the end', () => {
    const sigil = saturn(['A', 'B', 'C', 'D']);
    const first = revealSteps(sigil, 1);

    expect(first.complete).toBe(false);
    expect(first.strokes).toEqual([sigil.strokes[0]?.slice(0, 2)]);
    expect(first.marks.map((mark) => mark.kind)).toEqual(['start-circle']);

    const last = revealSteps(sigil, stepwiseStepCount(sigil));
    expect(last.complete).toBe(true);
    expect(last.strokes).toBe(sigil.strokes);
    expect(last.marks).toBe(sigil.marks);
  });

  it('adds one segment per step', () => {
    const sigil = saturn(['A', 'B', 'C', 'D']);

    expect(revealSteps(sigil, 2).strokes[0]).toHaveLength(3);
  });

  it('shows a loop once the path has reached its cell', () => {
    // B (2), then A and J both on 1: a loop on cell 1, then C (3), D (4).
    const sigil = saturn(['B', 'A', 'J', 'C', 'D']);
    expect(sigil.marks.some((mark) => mark.kind === 'loop')).toBe(true);

    const kindsAt = (step: number) => revealSteps(sigil, step).marks.map((mark) => mark.kind);
    expect(kindsAt(1)).toContain('loop');
    expect(kindsAt(1)).not.toContain('end-bar');
  });

  it('hides a loop the path has not reached yet', () => {
    // A, B, C, then D twice: the loop sits on the last cell.
    const sigil = saturn(['A', 'B', 'C', 'D', 'D']);

    expect(revealSteps(sigil, 1).marks.map((mark) => mark.kind)).toEqual(['start-circle']);
  });

  it('draws whole strokes one by one on a multi-stroke sigil', () => {
    expect(revealSteps(THREE_STROKES, 1).strokes).toEqual([THREE_STROKES.strokes[0]]);
    expect(revealSteps(THREE_STROKES, 2).strokes).toHaveLength(2);
    expect(revealSteps(THREE_STROKES, 3).complete).toBe(true);
  });

  it('treats a step past the end as the whole sigil', () => {
    expect(revealSteps(THREE_STROKES, 99).complete).toBe(true);
  });
});
