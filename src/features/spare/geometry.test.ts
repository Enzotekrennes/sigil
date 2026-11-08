/**
 * Unit tests of the plane geometry shared by the Spare scoring and
 * simplification: segments of polylines, lengths and the rounding of frame
 * coordinates.
 */
import { describe, expect, it } from 'vitest';

import { roundCoordinate, segmentLength, strokeSegments } from './geometry.ts';

describe('strokeSegments', () => {
  it('splits each polyline into its segments, stroke after stroke', () => {
    const segments = strokeSegments([
      [
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 3, y: 10 },
      ],
      [{ x: 1, y: 1 }],
    ]);
    expect(segments).toHaveLength(2);
    expect(segments.map(segmentLength)).toEqual([5, 6]);
  });
});

describe('roundCoordinate', () => {
  it('keeps four decimals and never returns −0', () => {
    expect(roundCoordinate(12.345678)).toBe(12.3457);
    expect(Object.is(roundCoordinate(-0.00001), 0)).toBe(true);
  });
});
