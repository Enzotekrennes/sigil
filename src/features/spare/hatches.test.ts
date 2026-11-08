/**
 * Unit tests of the hatch search and correction: two parallel strokes count
 * as a hatch only between the confounded and the spaced-out gaps, over a
 * common length and within the parallel angle; the correction lays the
 * shorter stroke onto the longer one, keeps joints and leaves clean drawings alone.
 */
import { describe, expect, it } from 'vitest';

import type { Point } from '../sigil/types.ts';
import { strokeSegments } from './geometry.ts';
import {
  MAX_HATCH_GAP,
  MIN_HATCH_GAP,
  MIN_HATCH_OVERLAP,
  correctHatches,
  findHatches,
} from './hatches.ts';

/**
 * A horizontal stroke.
 *
 * @param y - Its height.
 * @param from - x of its left end.
 * @param to - x of its right end.
 * @returns The two-point polyline.
 */
function bar(y: number, from = 30, to = 50): Point[] {
  return [
    { x: from, y },
    { x: to, y },
  ];
}

/**
 * Number of hatches of some strokes.
 *
 * @param strokes - Polylines.
 * @returns The number of hatch pairs.
 */
function hatchCount(strokes: readonly (readonly Point[])[]): number {
  return findHatches(strokeSegments(strokes)).length;
}

describe('findHatches', () => {
  it('finds two parallel strokes a few units apart along a common length', () => {
    expect(findHatches(strokeSegments([bar(40), bar(42)]))).toEqual([[0, 1]]);
    expect(hatchCount([bar(40), bar(40 + MAX_HATCH_GAP)])).toBe(1);
    expect(hatchCount([bar(40), bar(40 + MIN_HATCH_GAP)])).toBe(1);
  });

  it('ignores strokes confounded into one line, or far enough apart to read as space', () => {
    expect(hatchCount([bar(40), bar(40.3)])).toBe(0);
    expect(hatchCount([bar(40), bar(46)])).toBe(0);
  });

  it('ignores parallel strokes that run side by side over too short a length', () => {
    expect(hatchCount([bar(40, 30, 50), bar(42, 50 - MIN_HATCH_OVERLAP + 0.5, 70)])).toBe(0);
    expect(hatchCount([bar(40, 30, 50), bar(42, 50 - MIN_HATCH_OVERLAP - 0.5, 70)])).toBe(1);
  });

  it('ignores strokes at a clear angle', () => {
    const slanted = [
      { x: 30, y: 42 },
      { x: 50, y: 42 + 20 * Math.tan((20 * Math.PI) / 180) },
    ];
    expect(hatchCount([bar(40), slanted])).toBe(0);
  });

  it('finds hatches between vertical strokes too', () => {
    const stem = [
      { x: 50, y: 10 },
      { x: 50, y: 90 },
    ];
    const near = [
      { x: 52, y: 30 },
      { x: 52, y: 60 },
    ];
    expect(hatchCount([stem, near])).toBe(1);
  });
});

describe('correctHatches', () => {
  it('returns the same strokes when there is no hatch', () => {
    const strokes = [bar(40), bar(60)];
    expect(correctHatches(strokes)).toBe(strokes);
  });

  it('lays the shorter stroke onto the longer one, where they are drawn once', () => {
    const corrected = correctHatches([bar(40, 20, 80), bar(42, 30, 50)]);
    expect(hatchCount(corrected)).toBe(0);
    expect(corrected).toEqual([bar(40, 20, 80)]);
  });

  it('moves the strokes joined to a corrected one with it', () => {
    const stem = [
      { x: 50, y: 10 },
      { x: 50, y: 90 },
    ];
    // A bar near the stem, with an arm leaving from its top end.
    const near: Point[] = [
      { x: 52, y: 30 },
      { x: 52, y: 60 },
    ];
    const arm: Point[] = [
      { x: 52, y: 30 },
      { x: 70, y: 20 },
    ];
    const corrected = correctHatches([stem, near, arm]);

    expect(hatchCount(corrected)).toBe(0);
    expect(corrected).toContainEqual([
      { x: 50, y: 30 },
      { x: 70, y: 20 },
    ]);
  });
});
