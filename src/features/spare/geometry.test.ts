/**
 * Unit tests of the plane geometry shared by the Spare scoring and
 * simplification: segment distances and the length-weighted centre of gravity.
 */
import { describe, expect, it } from 'vitest';

import { centreOfGravity, roundCoordinate, segmentDistance, strokeSegments } from './geometry.ts';

describe('segmentDistance', () => {
  it('is zero for crossing segments', () => {
    const a = { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } };
    const b = { start: { x: 0, y: 10 }, end: { x: 10, y: 0 } };
    expect(segmentDistance(a, b)).toBe(0);
  });

  it('is zero for segments meeting at an end', () => {
    const a = { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
    const b = { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } };
    expect(segmentDistance(a, b)).toBe(0);
  });

  it('is the gap between the closest points of separate segments', () => {
    const a = { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
    const b = { start: { x: 5, y: 3 }, end: { x: 5, y: 8 } };
    expect(segmentDistance(a, b)).toBeCloseTo(3, 12);
  });

  it('measures to the end of a segment, not to its infinite line', () => {
    const a = { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
    const b = { start: { x: 14, y: 3 }, end: { x: 20, y: 3 } };
    expect(segmentDistance(a, b)).toBeCloseTo(5, 12);
  });
});

describe('centreOfGravity', () => {
  it('weights each segment by its length', () => {
    // A long horizontal segment and a short vertical one: the long one dominates.
    const segments = strokeSegments([
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 10 },
      ],
    ]);
    // (30 × (15, 0) + 10 × (0, 5)) / 40.
    expect(centreOfGravity(segments)).toEqual({ x: 11.25, y: 1.25 });
  });

  it('is undefined for a drawing without length', () => {
    expect(centreOfGravity([])).toBeUndefined();
  });
});

describe('roundCoordinate', () => {
  it('keeps four decimals and never returns −0', () => {
    expect(roundCoordinate(12.345678)).toBe(12.3457);
    expect(Object.is(roundCoordinate(-0.00001), 0)).toBe(true);
  });
});
