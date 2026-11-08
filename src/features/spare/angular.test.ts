/**
 * Unit tests of the angular letter skeletons (decision D20): every curve of
 * the 26 Hershey capitals redrawn with 2 to 4 straight segments, straight
 * strokes kept, the expected rune shapes (diamond O, zigzag S, chevron C,
 * triangular bowls), joints kept, and the pure redrawing on synthetic curves.
 */
import { describe, expect, it } from 'vitest';

import type { Point } from '../sigil/types.ts';
import {
  MAX_CURVE_SEGMENTS,
  MIN_CURVE_SEGMENTS,
  angularStrokes,
  getAngularGlyph,
} from './angular.ts';
import { getGlyph } from './glyphs/index.ts';
import type { CapitalLetter } from './glyphs/index.ts';

/** The 26 letters with a glyph. */
const ALPHABET: readonly CapitalLetter[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
];

/**
 * Most segments of one angular letter: B (stem and two triangles) has 5,
 * Q (diamond and tail) 5, G (four-segment curve and bar) 5.
 */
const MAX_LETTER_SEGMENTS = 6;

/**
 * Number of segments of a polyline.
 *
 * @param stroke - Polyline.
 * @returns Its point count minus one.
 */
function segmentCount(stroke: readonly Point[]): number {
  return stroke.length - 1;
}

/**
 * A half circle of radius 10 bulging to the right, sampled every 15°, from
 * the top to the bottom, rounded to a millionth: a Hershey-like bowl.
 *
 * @returns The polyline.
 */
function halfCircle(): Point[] {
  return Array.from({ length: 13 }, (_, step) => {
    const angle = -Math.PI / 2 + (step * Math.PI) / 12;
    // Rounded so that the ends lie exactly on the vertical x = 0.
    const round = (value: number): number => Math.round(value * 1e6) / 1e6 + 0;
    return { x: round(10 * Math.cos(angle)), y: round(10 * Math.sin(angle)) };
  });
}

describe('getAngularGlyph', () => {
  it.each(ALPHABET)('redraws every curve of %s with 2 to 4 straight segments', (letter) => {
    const hershey = getGlyph(letter).strokes;
    const { strokes } = getAngularGlyph(letter);

    expect(strokes).toHaveLength(hershey.length);
    strokes.forEach((stroke, index) => {
      const original = hershey[index] ?? [];
      if (original.length <= 2) {
        expect(segmentCount(stroke)).toBe(1);
      } else {
        expect(segmentCount(stroke)).toBeGreaterThanOrEqual(MIN_CURVE_SEGMENTS);
        expect(segmentCount(stroke)).toBeLessThanOrEqual(MAX_CURVE_SEGMENTS);
      }
      for (let point = 1; point < stroke.length; point += 1) {
        expect(stroke[point]).not.toEqual(stroke[point - 1]);
      }
    });
    expect(strokes.reduce((count, stroke) => count + segmentCount(stroke), 0)).toBeLessThanOrEqual(
      MAX_LETTER_SEGMENTS,
    );
  });

  it.each(ALPHABET)('keeps %s inside its Hershey bounding box', (letter) => {
    const { bounds } = getGlyph(letter);
    for (const point of getAngularGlyph(letter).strokes.flat()) {
      expect(point.x).toBeGreaterThanOrEqual(bounds.x);
      expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(point.y).toBeGreaterThanOrEqual(bounds.y);
      expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
  });

  it('leaves the letters made of straight strokes unchanged', () => {
    for (const letter of ['A', 'E', 'K', 'M', 'X', 'Z'] as const) {
      expect(getAngularGlyph(letter).strokes).toEqual(getGlyph(letter).strokes);
    }
  });

  it('turns O into the diamond through the middles of its sides', () => {
    expect(getAngularGlyph('O').strokes).toEqual([
      [
        { x: 11, y: -21 },
        { x: 19, y: -10.5 },
        { x: 11, y: 0 },
        { x: 3, y: -10.5 },
        { x: 11, y: -21 },
      ],
    ]);
  });

  it('turns S into a three-stroke zigzag, symmetric about its centre', () => {
    const [stroke = []] = getAngularGlyph('S').strokes;
    expect(segmentCount(stroke)).toBe(3);
    const centre = { x: 10, y: -10.5 };
    stroke.forEach((point, index) => {
      const opposite = stroke[stroke.length - 1 - index];
      expect(opposite?.x).toBeCloseTo(2 * centre.x - point.x);
      expect(opposite?.y).toBeCloseTo(2 * centre.y - point.y);
    });
  });

  it('turns C into a chevron pointing left', () => {
    expect(getAngularGlyph('C').strokes).toEqual([
      [
        { x: 18, y: -16 },
        { x: 3, y: -10.5 },
        { x: 18, y: -5 },
      ],
    ]);
  });

  it.each(['B', 'D', 'P', 'R'] as const)(
    'turns the bowls of %s into triangles standing on the stem',
    (letter) => {
      const bowls = getAngularGlyph(letter).strokes.filter((stroke) => stroke.length === 3);
      expect(bowls.length).toBeGreaterThan(0);
      for (const [start, apex, end] of bowls) {
        expect(start?.x).toBe(4);
        expect(end?.x).toBe(4);
        expect(apex?.x).toBe(18);
      }
    },
  );

  it('keeps the leg of R joined to its redrawn bowl', () => {
    const [, bowl = [], leg = []] = getAngularGlyph('R').strokes;
    const [start, apex, end] = bowl;
    const [legStart] = leg;
    if (start === undefined || apex === undefined || end === undefined || legStart === undefined) {
      throw new Error('Unexpected R skeleton');
    }
    // The leg starts on the lower edge of the triangle, from the apex to the stem.
    const cross =
      (end.x - apex.x) * (legStart.y - apex.y) - (end.y - apex.y) * (legStart.x - apex.x);
    expect(Math.abs(cross)).toBeLessThan(1e-6);
    expect(legStart.x).toBeGreaterThan(end.x);
    expect(legStart.x).toBeLessThan(apex.x);
  });

  it('keeps a vertical on the stem side of every letter that had one', () => {
    for (const letter of [
      'B',
      'D',
      'E',
      'F',
      'H',
      'I',
      'K',
      'L',
      'M',
      'N',
      'P',
      'R',
      'T',
    ] as const) {
      const hasVertical = getAngularGlyph(letter).strokes.some((stroke) =>
        stroke.some((point, index) => index > 0 && stroke[index - 1]?.x === point.x),
      );
      expect(hasVertical).toBe(true);
    }
  });
});

describe('angularStrokes', () => {
  it('turns a bowl standing on a vertical into a triangle pointing at its farthest point', () => {
    expect(angularStrokes([halfCircle()])).toEqual([
      [
        { x: 0, y: -10 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ],
    ]);
  });

  it('simplifies an open curve to between 2 and 4 segments and keeps its ends', () => {
    // A quarter circle followed by a straight run: not a bowl.
    const curve = [
      ...Array.from({ length: 7 }, (_, step) => {
        const angle = (step * Math.PI) / 12;
        return { x: 10 * Math.cos(angle), y: 10 * Math.sin(angle) };
      }),
      { x: -10, y: 10 },
    ];
    const [stroke = []] = angularStrokes([curve]);

    expect(segmentCount(stroke)).toBeGreaterThanOrEqual(MIN_CURVE_SEGMENTS);
    expect(segmentCount(stroke)).toBeLessThanOrEqual(MAX_CURVE_SEGMENTS);
    expect(stroke[0]).toEqual(curve[0]);
    expect(stroke[stroke.length - 1]).toEqual(curve[curve.length - 1]);
  });

  it('caps a wavy curve at 4 segments, raising the tolerance', () => {
    const wave = Array.from({ length: 41 }, (_, step) => ({
      x: step,
      y: 8 * Math.sin((step * Math.PI) / 5),
    }));
    const [stroke = []] = angularStrokes([wave]);
    expect(segmentCount(stroke)).toBeLessThanOrEqual(MAX_CURVE_SEGMENTS);
    expect(segmentCount(stroke)).toBeGreaterThanOrEqual(MIN_CURVE_SEGMENTS);
  });

  it('keeps two-point strokes as they are, without sharing them', () => {
    const bar = [
      { x: 0, y: 0 },
      { x: 5, y: 1 },
    ];
    const [redrawn] = angularStrokes([bar]);
    expect(redrawn).toEqual(bar);
    expect(redrawn).not.toBe(bar);
  });
});
