/**
 * Tests of the stencil geometry (F5): the millimetre setting, the exact ink
 * edge of a drawing (round and flat ends, mitred and bevelled joins, marks),
 * and the scale that makes the ink measure the print size with a stroke of
 * the chosen millimetres.
 */
import { describe, expect, it } from 'vitest';

import { buildKameaSigil } from '../kamea/index.ts';
import { buildSpareSigil } from '../spare/index.ts';
import {
  inkBounds,
  snapStencilStrokeMm,
  stencilScale,
  STENCIL_STROKE_MM_DEFAULT,
  STENCIL_STROKE_MM_MAX,
  STENCIL_STROKE_MM_MIN,
} from './stencil.ts';
import type { Sigil } from './types.ts';

/** "Je suis calme" after normalisation. */
const JE_SUIS_CALME = ['J', 'E', 'S', 'U', 'I', 'S', 'C', 'A', 'L', 'M', 'E'];

/**
 * Builds a kamea sigil and fails the test if the builder refused.
 *
 * @param planet - Square to draw on.
 * @returns The sigil.
 */
function kamea(planet: 'saturn' | 'moon' = 'saturn'): Sigil {
  const result = buildKameaSigil(JE_SUIS_CALME, planet);
  if (!result.ok) throw new Error(`Unexpected kamea error ${result.error.code}`);
  return result.data;
}

/**
 * Builds the first Spare variant and fails the test if the builder refused.
 *
 * @returns The sigil.
 */
function spare(): Sigil {
  const result = buildSpareSigil(JE_SUIS_CALME, { keepVowels: false, variant: 0 });
  if (!result.ok) throw new Error(`Unexpected Spare error ${result.error.code}`);
  return result.data;
}

describe('snapStencilStrokeMm', () => {
  it.each([
    [0.6, 0.6],
    [0.64, 0.6],
    [0.3000000004, 0.3],
    [0.1, STENCIL_STROKE_MM_MIN],
    [2, STENCIL_STROKE_MM_MAX],
    [Number.NaN, STENCIL_STROKE_MM_DEFAULT],
  ])('brings %s mm to %s mm', (value, expected) => {
    expect(snapStencilStrokeMm(value)).toBe(expected);
  });

  it('offers 0.3 to 1.2 mm, 0.6 mm by default (docs/design.md)', () => {
    expect([STENCIL_STROKE_MM_MIN, STENCIL_STROKE_MM_DEFAULT, STENCIL_STROKE_MM_MAX]).toEqual([
      0.3, 0.6, 1.2,
    ]);
  });
});

describe('inkBounds', () => {
  /** An L: right along y = 10, then down along x = 50. */
  const corner = {
    strokes: [
      [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 50, y: 40 },
      ],
    ],
    marks: [],
  };

  it('widens the geometry by half a stroke on every side with round ends', () => {
    expect(inkBounds(corner, 2, true)).toEqual({ x: 9, y: 9, width: 42, height: 32 });
  });

  it('keeps flat ends on their segment and adds the square miter of a right angle', () => {
    // Flat start at x = 10, miter tip at (51, 9), flat end at y = 40.
    expect(inkBounds(corner, 2, false)).toEqual({ x: 10, y: 9, width: 41, height: 31 });
  });

  it('bevels a join sharper than the miter limit instead of reaching its tip', () => {
    // A hairpin: the miter would reach far beyond the turn; the limit of 4 bevels it.
    const hairpin = {
      strokes: [
        [
          { x: 10, y: 10 },
          { x: 50, y: 11 },
          { x: 10, y: 12 },
        ],
      ],
      marks: [],
    };

    expect(inkBounds(hairpin, 2, false).width).toBeLessThan(41.1);
  });

  it('counts the marks with their stroke', () => {
    const marked = {
      strokes: [
        [
          { x: 20, y: 20 },
          { x: 30, y: 20 },
        ],
      ],
      marks: [{ kind: 'start-circle' as const, center: { x: 20, y: 20 }, radius: 3 }],
    };

    expect(inkBounds(marked, 1, true)).toEqual({ x: 16.5, y: 16.5, width: 14, height: 7 });
  });
});

describe('stencilScale', () => {
  it.each([
    ['kamea Saturn', () => kamea(), 0.6, 60, true],
    ['kamea Moon, smallest size, thickest stroke', () => kamea('moon'), 1.2, 10, true],
    ['kamea Saturn, flat ends', () => kamea(), 0.3, 250, false],
    ['Spare', spare, 0.6, 60, true],
    ['Spare, thickest stroke at 1 cm', spare, 1.2, 10, true],
  ] as const)(
    'prints %s at the size and stroke asked for',
    (_, make, strokeMm, sizeMm, roundEnds) => {
      const scale = stencilScale(make(), roundEnds, strokeMm, sizeMm);
      const k = scale.millimetresPerUnit;

      expect(Math.max(scale.ink.width, scale.ink.height) * k).toBeCloseTo(sizeMm, 9);
      expect(scale.strokeWidth * k).toBeCloseTo(strokeMm, 9);
      expect(scale.ink).toEqual(inkBounds(scale.drawing, scale.strokeWidth, roundEnds));
    },
  );

  it('gives a thinner line in frame units for a larger print', () => {
    const small = stencilScale(kamea(), true, 0.6, 30);
    const large = stencilScale(kamea(), true, 0.6, 120);

    expect(large.strokeWidth).toBeLessThan(small.strokeWidth);
  });

  it.each([
    [0, 60],
    [0.6, 0],
    [Number.NaN, 60],
    [0.6, Number.POSITIVE_INFINITY],
  ])('refuses a stroke of %s mm or a size of %s mm', (strokeMm, sizeMm) => {
    expect(() => stencilScale(kamea(), true, strokeMm, sizeMm)).toThrow(RangeError);
  });
});
