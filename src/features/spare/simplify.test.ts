/**
 * Unit tests of the merging and simplification of Spare strokes: duplicate
 * and overlapping collinear segments drawn once, near points merged, straight
 * runs reduced, drawing order kept, and curves left untouched.
 */
import { describe, expect, it } from 'vitest';

import type { Point } from '../sigil/types.ts';
import { pointSegmentDistance, strokeSegments } from './geometry.ts';
import {
  MIN_STRAIGHT_LENGTH,
  POINT_MERGE_TOLERANCE,
  STRAIGHT_MERGE_TOLERANCE,
  simplifyStrokes,
} from './simplify.ts';

/**
 * Shorthand for a point.
 *
 * @param x - Abscissa in frame units.
 * @param y - Ordinate in frame units.
 * @returns The point.
 */
function p(x: number, y: number): Point {
  return { x, y };
}

/**
 * Total length of polylines, to check that ink is neither lost nor doubled.
 *
 * @param strokes - Polylines.
 * @returns The sum of segment lengths.
 */
function inkLength(strokes: readonly (readonly Point[])[]): number {
  return strokeSegments(strokes).reduce(
    (total, { start, end }) => total + Math.hypot(end.x - start.x, end.y - start.y),
    0,
  );
}

describe('simplifyStrokes', () => {
  it('draws a duplicated segment once, whatever its direction', () => {
    const result = simplifyStrokes([
      [p(10, 10), p(50, 10)],
      [p(50, 10), p(10, 10)],
    ]);

    expect(result.strokes).toEqual([[p(10, 10), p(50, 10)]]);
    expect(result.segmentCountBefore).toBe(2);
    expect(result.segmentCountAfter).toBe(1);
  });

  it('draws two overlapping collinear segments as their union, once', () => {
    const { strokes } = simplifyStrokes([
      [p(10, 20), p(50, 20)],
      [p(30, 20), p(80, 20)],
    ]);

    expect(strokes).toEqual([
      [p(10, 20), p(50, 20)],
      [p(50, 20), p(80, 20)],
    ]);
    expect(inkLength(strokes)).toBeCloseTo(70, 9);
  });

  it('keeps both ends of a segment that an earlier one covers in its middle', () => {
    const { strokes } = simplifyStrokes([
      [p(40, 50), p(60, 50)],
      [p(10, 50), p(90, 50)],
    ]);

    expect(strokes).toEqual([
      [p(40, 50), p(60, 50)],
      [p(10, 50), p(40, 50)],
      [p(60, 50), p(90, 50)],
    ]);
  });

  it('merges long parallel strokes closer than the straight tolerance, without a step', () => {
    const gap = STRAIGHT_MERGE_TOLERANCE * 0.8;
    const { strokes } = simplifyStrokes([
      [p(10, 30), p(60, 30)],
      [p(20, 30 + gap), p(80, 30 + gap)],
    ]);

    expect(strokes).toEqual([
      [p(10, 30), p(60, 30)],
      [p(60, 30), p(80, 30 + gap)],
    ]);
  });

  it('keeps long parallel strokes further apart than the straight tolerance', () => {
    const input = [
      [p(10, 30), p(60, 30)],
      [p(20, 30 + STRAIGHT_MERGE_TOLERANCE * 1.5), p(80, 30 + STRAIGHT_MERGE_TOLERANCE * 1.5)],
    ];
    expect(simplifyStrokes(input).strokes).toEqual(input);
  });

  it('keeps short parallel segments, such as nearby arcs, beyond the point tolerance', () => {
    const length = MIN_STRAIGHT_LENGTH / 2;
    const gap = POINT_MERGE_TOLERANCE * 2;
    const input = [
      [p(40, 40), p(40 + length, 40)],
      [p(40, 40 + gap), p(40 + length, 40 + gap)],
    ];
    expect(simplifyStrokes(input).strokes).toEqual(input);
  });

  it('merges points closer than the point tolerance onto the first one drawn', () => {
    const near = p(50 + POINT_MERGE_TOLERANCE / 2, 50);
    const { strokes } = simplifyStrokes([
      [p(20, 20), p(50, 50)],
      [near, p(80, 20)],
    ]);

    expect(strokes).toEqual([
      [p(20, 20), p(50, 50)],
      [p(50, 50), p(80, 20)],
    ]);
  });

  it('removes middle points of straight runs and keeps corners', () => {
    const { strokes } = simplifyStrokes([[p(10, 10), p(20, 10), p(30, 10), p(30, 40)]]);
    expect(strokes).toEqual([[p(10, 10), p(30, 10), p(30, 40)]]);
  });

  it('keeps the drawing order of strokes untouched by merging', () => {
    const input = [
      [p(10, 80), p(30, 60), p(10, 40)],
      [p(50, 80), p(70, 60)],
      [p(90, 80), p(80, 50), p(90, 20)],
    ];
    expect(simplifyStrokes(input).strokes).toEqual(input);
  });

  it('drops a stroke that is entirely drawn already', () => {
    const { strokes } = simplifyStrokes([
      [p(10, 10), p(90, 10), p(90, 90)],
      [p(30, 10), p(60, 10)],
      [p(20, 50), p(70, 50)],
    ]);

    expect(strokes).toEqual([
      [p(10, 10), p(90, 10), p(90, 90)],
      [p(20, 50), p(70, 50)],
    ]);
  });

  it('keeps every output point within the merge tolerance of the input drawing', () => {
    const input = [
      [p(10, 10), p(40, 40), p(70, 10)],
      [p(10, 10.3), p(40, 40.2), p(90, 40)],
      [p(20, 70), p(80, 71)],
      [p(25, 70.8), p(85, 71.5)],
    ];
    const inputSegments = strokeSegments(input);
    for (const point of simplifyStrokes(input).strokes.flat()) {
      const nearest = Math.min(
        ...inputSegments.map((segment) => pointSegmentDistance(point, segment)),
      );
      expect(nearest).toBeLessThanOrEqual(STRAIGHT_MERGE_TOLERANCE);
    }
  });

  it('returns no stroke for an empty drawing', () => {
    expect(simplifyStrokes([])).toEqual({
      strokes: [],
      segmentCountBefore: 0,
      segmentCountAfter: 0,
    });
  });
});
