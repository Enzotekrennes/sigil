/**
 * Unit tests of the plane geometry shared by the Spare scoring and
 * simplification: the length-weighted centre of gravity and the rounding of
 * frame coordinates.
 */
import { describe, expect, it } from 'vitest';

import { centreOfGravity, roundCoordinate, strokeSegments } from './geometry.ts';

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
