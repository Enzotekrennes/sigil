/**
 * Unit tests of the kamea sigil builder: conversion per planet, path through
 * the right cells, start / end / loop marks, explanation steps, business
 * errors and determinism.
 */
import { describe, expect, it } from 'vitest';

import { frameFitScale, scaleDrawing } from '../sigil/frameFit.ts';
import type { Drawing } from '../sigil/frameFit.ts';
import {
  frameCenter,
  MARK_REFERENCE_STROKE_WIDTH,
  scaleMark,
  STROKE_WIDTH_MAX,
  STROKE_WIDTH_MIN,
} from '../sigil/style.ts';
import type { EndBarMark, LoopMark, Mark, Point, Sigil } from '../sigil/types.ts';
import { buildKameaSigil } from './buildKameaSigil.ts';
import type { KameaError } from './buildKameaSigil.ts';
import type { Planet } from '../sigil/types.ts';
import { PLANETS } from './squares.ts';

/** "Je suis calme" after normalisation. */
const JE_SUIS_CALME = ['J', 'E', 'S', 'U', 'I', 'S', 'C', 'A', 'L', 'M', 'E'];

/** "Belle allée" after normalisation: two runs of L and a final run of E. */
const BELLE_ALLEE = ['B', 'E', 'L', 'L', 'E', 'A', 'L', 'L', 'E', 'E'];

/** Stroke width the marks are sized for, in frame units. */
const REFERENCE_STROKE = 1.2;

/** Side N of each planet's square. */
const ORDERS: Readonly<Record<Planet, number>> = {
  saturn: 3,
  jupiter: 4,
  mars: 5,
  sun: 6,
  venus: 7,
  mercury: 8,
  moon: 9,
};

/**
 * Design mark sizes (start circle radius 3, loop radius 3.6, end bar 9.6)
 * multiplied by a scale, the start circle never under 2.4.
 *
 * @param scale - Shrink factor, 1 for the full size.
 * @returns The expected sizes in frame units.
 */
function sizesAt(scale: number): { startCircle: number; loop: number; endBar: number } {
  return { startCircle: Math.max(3 * scale, 2.4), loop: 3.6 * scale, endBar: 9.6 * scale };
}

/**
 * Expected mark sizes per square: full size while a cell (80 / N) is at least
 * 18 units, then shrunk by cell / 18.
 */
const EXPECTED_SIZES: Readonly<Record<Planet, ReturnType<typeof sizesAt>>> = {
  saturn: sizesAt(1),
  jupiter: sizesAt(1),
  mars: sizesAt(16 / 18),
  sun: sizesAt(80 / 6 / 18),
  venus: sizesAt(80 / 7 / 18),
  mercury: sizesAt(10 / 18),
  moon: sizesAt(80 / 9 / 18),
};

/**
 * Cell of the grid a point falls in, as a `"row:column"` key.
 *
 * @param point - Point in frame units, inside the grid.
 * @param planet - Square whose grid is used.
 * @returns The cell key, or `"none"` when the point is missing.
 */
function cellOf(point: Point | undefined, planet: Planet): string {
  if (point === undefined) return 'none';
  const size = 80 / ORDERS[planet];
  const row = Math.floor((point.y - 10) / size);
  const column = Math.floor((point.x - 10) / size);
  return `${String(row)}:${String(column)}`;
}

/**
 * Builds a sigil and fails the test if the builder refused.
 *
 * @param letters - Normalised letters.
 * @param planet - Square to use.
 * @returns The sigil.
 */
function build(letters: readonly string[], planet: Planet): Sigil {
  const result = buildKameaSigil(letters, planet);
  if (!result.ok) throw new Error(`Unexpected kamea error ${result.error.code}`);
  return result.data;
}

/**
 * Builds and returns the business error, failing the test if a sigil was drawn.
 *
 * @param letters - Normalised letters.
 * @param planet - Square to use.
 * @returns The error.
 */
function buildError(letters: readonly string[], planet: Planet): KameaError {
  const result = buildKameaSigil(letters, planet);
  if (result.ok) throw new Error('Expected a kamea error');
  return result.error;
}

/**
 * Reads the numbers of the letter table step.
 *
 * @param sigil - Kamea sigil.
 * @returns One number per letter, empty if the step is missing.
 */
function numbersOf(sigil: Sigil): number[] {
  const table = sigil.steps.find((step) => step.kind === 'kamea-letter-table');
  return table?.entries.map((entry) => entry.number) ?? [];
}

/**
 * Expected centre of a cell, the grid filling the central 80 × 80 of the frame.
 *
 * @param row - Zero-based row.
 * @param column - Zero-based column.
 * @param order - Side N of the square.
 * @returns The centre in frame units.
 */
function center(row: number, column: number, order: number): Point {
  const size = 80 / order;
  return { x: 10 + (column + 0.5) * size, y: 10 + (row + 0.5) * size };
}

/**
 * Keeps the marks of one kind, typed accordingly.
 *
 * @param sigil - Sigil to read.
 * @param kind - Mark kind to keep.
 * @returns The marks of that kind, in drawing order.
 */
function marksOf<K extends Mark['kind']>(sigil: Sigil, kind: K): Extract<Mark, { kind: K }>[] {
  return sigil.marks.filter((mark): mark is Extract<Mark, { kind: K }> => mark.kind === kind);
}

/**
 * Stroke widths checked: the thinnest, the reference and the thickest the
 * setting offers (decision D15), plus 4, the former maximum, as a margin
 * beyond the range.
 */
const WIDTHS = [STROKE_WIDTH_MIN, MARK_REFERENCE_STROKE_WIDTH, STROKE_WIDTH_MAX, 4];

/** Intentions whose last cell carries a loop, reaching it from several directions. */
const END_LOOP_INTENTIONS: readonly (readonly string[])[] = [
  ['A', 'B', 'B'],
  ['B', 'B', 'A', 'B'],
  ['C', 'A', 'A'],
  ['M', 'E', 'E'],
  ['Z', 'Y', 'Y'],
  BELLE_ALLEE,
  [...JE_SUIS_CALME, 'E'],
  ['A', 'M', 'O', 'U', 'R', 'R'],
  ['P', 'A', 'I', 'X', 'X'],
];

/**
 * Normalises a vector.
 *
 * @param vector - Non-null vector.
 * @returns The vector of length 1 in the same direction.
 */
function unitVector(vector: Point): Point {
  const size = Math.hypot(vector.x, vector.y);
  return { x: vector.x / size, y: vector.y / size };
}

/**
 * Strokes and marks as `SigilRenderer` draws them: marks resized to the
 * stroke width, then the whole drawing fitted in the framing circle when shown.
 *
 * @param sigil - Kamea sigil.
 * @param strokeWidth - Chosen stroke width in frame units.
 * @param frameCircle - Whether the framing circle is shown.
 * @returns The drawing in frame units.
 */
function renderedDrawing(sigil: Sigil, strokeWidth: number, frameCircle: boolean): Drawing {
  const center = frameCenter(sigil.viewBox);
  const whole = {
    strokes: sigil.strokes,
    marks: sigil.marks.map((mark) => scaleMark(mark, strokeWidth)),
  };
  const fit = frameCircle ? frameFitScale(whole, strokeWidth, center) : 1;
  return scaleDrawing(whole, fit, center);
}

/**
 * Last segment, end bar and loop of the last cell.
 *
 * @param drawing - Sigil or rendered drawing whose last cell carries a loop.
 * @returns The two last points, the end bar and the end loop.
 * @throws {Error} When one of them is missing.
 */
function endOf(drawing: Drawing): {
  beforeEnd: Point;
  end: Point;
  bar: EndBarMark;
  loop: LoopMark;
} {
  const stroke = drawing.strokes[drawing.strokes.length - 1] ?? [];
  const end = stroke[stroke.length - 1];
  const beforeEnd = stroke[stroke.length - 2];
  const bar = drawing.marks.find((mark): mark is EndBarMark => mark.kind === 'end-bar');
  const loop = drawing.marks.find(
    (mark): mark is LoopMark => mark.kind === 'loop' && mark.lastSegment !== undefined,
  );
  if (end === undefined || beforeEnd === undefined || bar === undefined || loop === undefined) {
    throw new Error('Missing end of path, end bar or end loop');
  }
  return { beforeEnd, end, bar, loop };
}

/**
 * Point where the end loop touches the last segment.
 *
 * @param drawing - Drawing whose last cell carries a loop.
 * @returns The foot of the perpendicular from the loop centre to the last segment.
 */
function tangencyPoint(drawing: Drawing): Point {
  const { beforeEnd, end, loop } = endOf(drawing);
  const segment = { x: beforeEnd.x - end.x, y: beforeEnd.y - end.y };
  const squared = segment.x * segment.x + segment.y * segment.y;
  const t = ((loop.center.x - end.x) * segment.x + (loop.center.y - end.y) * segment.y) / squared;
  return { x: end.x + t * segment.x, y: end.y + t * segment.y };
}

/**
 * Paper left between the outer edges of the end loop's stroke and the end
 * bar's stroke: distance from the loop centre to the bar segment, minus the
 * radius, minus half a stroke on each side.
 *
 * @param drawing - Drawing whose last cell carries a loop.
 * @param strokeWidth - Stroke width it is drawn with.
 * @returns The gap in frame units; zero or less means the strokes touch.
 */
function edgeGap(drawing: Drawing, strokeWidth: number): number {
  const { bar, loop } = endOf(drawing);
  const radians = (bar.angle * Math.PI) / 180;
  const along = { x: Math.cos(radians), y: Math.sin(radians) };
  const offset = { x: loop.center.x - bar.center.x, y: loop.center.y - bar.center.y };
  const onBar = offset.x * along.x + offset.y * along.y;
  const clamped = Math.max(-bar.length / 2, Math.min(bar.length / 2, onBar));
  const toBar = Math.hypot(offset.x - clamped * along.x, offset.y - clamped * along.y);
  return toBar - loop.radius - strokeWidth;
}

describe('buildKameaSigil', () => {
  describe('"Je suis calme" on Saturn', () => {
    const sigil = build(JE_SUIS_CALME, 'saturn');

    it('converts the letters with the Pythagorean reduction', () => {
      expect(numbersOf(sigil)).toEqual([1, 5, 1, 3, 9, 1, 3, 1, 3, 4, 5]);
    });

    it('draws one stroke through the cells of those numbers', () => {
      // Saturn: 4 9 2 / 3 5 7 / 8 1 6.
      const one = center(2, 1, 3);
      const three = center(1, 0, 3);
      const four = center(0, 0, 3);
      const five = center(1, 1, 3);
      const nine = center(0, 1, 3);
      expect(sigil.strokes).toEqual([
        [one, five, one, three, nine, one, three, one, three, four, five],
      ]);
    });

    it('records the visited cells for the explanation panel', () => {
      const path = sigil.steps.find((step) => step.kind === 'kamea-square-path');
      expect(path?.cells[0]).toEqual({ row: 2, column: 1 });
      expect(path?.cells[4]).toEqual({ row: 0, column: 1 });
      expect(path?.numbers).toEqual([1, 5, 1, 3, 9, 1, 3, 1, 3, 4, 5]);
    });

    it('exposes the conversion rule, the letter table and the square, in that order', () => {
      expect(sigil.steps.map((step) => step.kind)).toEqual([
        'kamea-conversion-rule',
        'kamea-letter-table',
        'kamea-square-path',
      ]);
      expect(sigil.steps[0]).toEqual({
        kind: 'kamea-conversion-rule',
        rule: 'rank-wrap',
        planet: 'saturn',
        order: 3,
        cellCount: 9,
      });
      const table = sigil.steps.find((step) => step.kind === 'kamea-letter-table');
      expect(table?.entries[0]).toEqual({ letter: 'J', rank: 10, number: 1 });
    });

    it('puts a circle on the first point', () => {
      const starts = marksOf(sigil, 'start-circle');
      expect(starts).toHaveLength(1);
      expect(starts[0]).toMatchObject({ center: center(2, 1, 3), radius: 3 });
      // Capped at 30 % of the 26.7-unit cell when the stroke thickens.
      expect(starts[0]?.maxRadius).toBeCloseTo(8, 9);
    });

    it('has no loop since no number repeats consecutively', () => {
      expect(marksOf(sigil, 'loop')).toEqual([]);
    });

    it('uses the 0–100 frame and a constant seed', () => {
      expect(sigil.viewBox).toEqual({ x: 0, y: 0, width: 100, height: 100 });
      expect(sigil.seed).toBe(0);
    });
  });

  it('keeps Z at 26 on the Moon', () => {
    expect(numbersOf(build(['A', 'Z'], 'moon'))).toEqual([1, 26]);
  });

  it('wraps Z to 10 on Jupiter', () => {
    expect(numbersOf(build(['A', 'Z'], 'jupiter'))).toEqual([1, 10]);
  });

  describe('end bar', () => {
    it.each<[string, readonly string[], Planet]>([
      ['diagonal', JE_SUIS_CALME, 'saturn'],
      ['horizontal', ['D', 'I'], 'saturn'],
      ['vertical', ['I', 'E'], 'saturn'],
      ['moon diagonal', ['A', 'B', 'C'], 'moon'],
    ])('is perpendicular to the last segment and centred on its end (%s)', (_, letters, planet) => {
      const sigil = build(letters, planet);
      const stroke = sigil.strokes[0] ?? [];
      const end = stroke[stroke.length - 1];
      const beforeEnd = stroke[stroke.length - 2];
      const [bar] = marksOf(sigil, 'end-bar');
      if (end === undefined || beforeEnd === undefined || bar === undefined) {
        throw new Error('Missing end of path or end bar');
      }

      const radians = (bar.angle * Math.PI) / 180;
      const barDirection = { x: Math.cos(radians), y: Math.sin(radians) };
      const segment = { x: end.x - beforeEnd.x, y: end.y - beforeEnd.y };
      expect(barDirection.x * segment.x + barDirection.y * segment.y).toBeCloseTo(0, 9);
      expect(bar.center).toEqual(end);
      expect(bar.angle).toBeGreaterThanOrEqual(0);
      expect(bar.angle).toBeLessThan(180);
      expect(bar.length).toBeCloseTo(EXPECTED_SIZES[planet].endBar, 9);
    });
  });

  describe('mark sizes', () => {
    it.each(PLANETS)('sizes the marks to the cells of the %s square', (planet) => {
      const sigil = build(['A', 'B', 'B', 'C'], planet);
      const expected = EXPECTED_SIZES[planet];
      expect(marksOf(sigil, 'start-circle')[0]?.radius).toBeCloseTo(expected.startCircle, 9);
      expect(marksOf(sigil, 'loop')[0]?.radius).toBeCloseTo(expected.loop, 9);
      expect(marksOf(sigil, 'end-bar')[0]?.length).toBeCloseTo(expected.endBar, 9);
    });

    it('keeps the design sizes on Saturn and Jupiter, whose cells are large enough', () => {
      for (const planet of ['saturn', 'jupiter'] as const) {
        const sigil = build(['A', 'B', 'B', 'C'], planet);
        expect(marksOf(sigil, 'start-circle')[0]?.radius).toBeCloseTo(3, 9);
        expect(marksOf(sigil, 'loop')[0]?.radius).toBeCloseTo(3.6, 9);
        expect(marksOf(sigil, 'end-bar')[0]?.length).toBeCloseTo(9.6, 9);
      }
    });

    it.each(PLANETS)('keeps every loop of %s inside its cell, stroke included', (planet) => {
      const order = ORDERS[planet];
      const half = 80 / order / 2;
      const sigil = build(['A', 'B', 'B', 'C', 'D', 'D', 'E'], planet);
      const loops = marksOf(sigil, 'loop');
      expect(loops).toHaveLength(2);
      for (const loop of loops) {
        const reach = Math.max(
          Math.abs(loop.center.x - loop.anchor.x),
          Math.abs(loop.center.y - loop.anchor.y),
        );
        expect(reach + loop.radius + REFERENCE_STROKE / 2).toBeLessThan(half);
      }
    });

    it.each(PLANETS)('keeps the end bar of %s inside its cell', (planet) => {
      const half = 80 / ORDERS[planet] / 2;
      const [bar] = marksOf(build(['A', 'B', 'C'], planet), 'end-bar');
      expect((bar?.length ?? Infinity) / 2 + REFERENCE_STROKE / 2).toBeLessThan(half);
    });

    it.each(PLANETS)('keeps the start circle of %s hollow and inside its cell', (planet) => {
      const half = 80 / ORDERS[planet] / 2;
      const [start] = marksOf(build(['A', 'B', 'C'], planet), 'start-circle');
      const radius = start?.radius ?? 0;
      // Around the line end (half a stroke), a ring one stroke wide stays empty.
      expect(radius - REFERENCE_STROKE / 2 - REFERENCE_STROKE / 2).toBeGreaterThanOrEqual(
        REFERENCE_STROKE - 1e-9,
      );
      expect(radius + REFERENCE_STROKE / 2).toBeLessThan(half);
    });
  });

  describe('loops', () => {
    // Saturn: B → 2 (top right), A and J → 1 (bottom middle), C → 3 (middle left).
    const sigil = build(['B', 'A', 'J', 'C'], 'saturn');
    const one = center(2, 1, 3);

    it('marks two consecutive identical numbers with a loop on their cell', () => {
      const loops = marksOf(sigil, 'loop');
      expect(loops).toHaveLength(1);
      expect(loops[0]?.anchor).toEqual(one);
      expect(loops[0]?.radius).toBeCloseTo(3.6, 9);
    });

    it('keeps the stroke continuous, without a zero-length segment', () => {
      expect(sigil.strokes).toEqual([[center(0, 2, 3), one, center(1, 0, 3)]]);
    });

    it('sets the loop tangent to the path, on the outer side of the turn', () => {
      const [loop] = marksOf(sigil, 'loop');
      if (loop === undefined) throw new Error('Missing loop');
      const offset = { x: loop.center.x - one.x, y: loop.center.y - one.y };
      expect(Math.hypot(offset.x, offset.y)).toBeCloseTo(loop.radius, 9);
      // The path comes down from the top right and leaves up-left: the turn
      // opens upwards, so the loop hangs below the cell centre.
      expect(offset.y).toBeGreaterThan(0);
    });

    it('also loops when different letters fall on the same number', () => {
      // A (1) and S (19 → 1) differ but share Saturn's cell 1.
      expect(marksOf(build(['B', 'A', 'S', 'C'], 'saturn'), 'loop')).toHaveLength(1);
    });

    it('draws one loop per run of repetitions and one per separate run', () => {
      const repeated = build(['B', 'A', 'J', 'S', 'C', 'L', 'B'], 'saturn');
      // 2, 1, 1, 1, 3, 3, 2: one run of 1 and one run of 3.
      expect(marksOf(repeated, 'loop').map((loop) => loop.anchor)).toEqual([one, center(1, 0, 3)]);
    });

    it('handles a repetition at the start of the path', () => {
      const atStart = build(['A', 'J', 'B'], 'saturn');
      const [loop] = marksOf(atStart, 'loop');
      expect(loop?.anchor).toEqual(one);
      expect(Number.isFinite(loop?.center.x)).toBe(true);
    });

    it('draws a single loop on a cell holding several separate runs', () => {
      // 2, 1, 1, 3, 1, 1, 2: two runs of 1, on the same cell.
      const twice = build(['B', 'A', 'J', 'C', 'S', 'A', 'B'], 'saturn');
      const loops = marksOf(twice, 'loop');
      expect(loops).toHaveLength(1);
      // The loop follows the path at the first run: from 2 to 3 through 1.
      expect(loops[0]).toEqual(marksOf(build(['B', 'A', 'J', 'C'], 'saturn'), 'loop')[0]);
    });

    it('draws one loop per looped cell for "Belle allée" on the Moon', () => {
      // 2, 5, 12, 12, 5, 1, 12, 12, 5, 5: 12 loops twice, 5 once at the end.
      const moon = build(BELLE_ALLEE, 'moon');
      expect(numbersOf(moon)).toEqual([2, 5, 12, 12, 5, 1, 12, 12, 5, 5]);
      const loops = marksOf(moon, 'loop');
      expect(loops).toHaveLength(2);
      const centres = loops.map((loop) => `${String(loop.center.x)}:${String(loop.center.y)}`);
      expect(new Set(centres).size).toBe(2);
    });
  });

  describe('loop on the last cell', () => {
    it.each(PLANETS)('is anchored on the end point and stays clear of the bar on %s', (planet) => {
      for (const letters of END_LOOP_INTENTIONS) {
        const sigil = build(letters, planet);
        const { end, loop } = endOf(sigil);
        expect(loop.anchor).toEqual(end);
        // At the reference width, a paper gap of one stroke width remains.
        expect(edgeGap(sigil, REFERENCE_STROKE)).toBeGreaterThanOrEqual(REFERENCE_STROKE - 1e-9);
        // The point where it touches the path lies in the last cell.
        expect(cellOf(tangencyPoint(sigil), planet)).toBe(cellOf(end, planet));
      }
    });

    it('keeps Saturn at the reference width as drawn before', () => {
      // 1 (bottom middle) → 2 (top right): loop touching 6 units back from the end, radius 3.6.
      const { loop, end, beforeEnd } = endOf(build(['A', 'B', 'B'], 'saturn'));
      const back = unitVector({ x: beforeEnd.x - end.x, y: beforeEnd.y - end.y });
      const offset = { x: loop.center.x - end.x, y: loop.center.y - end.y };
      expect(offset.x * back.x + offset.y * back.y).toBeCloseTo(3.6 + 2.4, 9);
      expect(Math.abs(offset.x * back.y - offset.y * back.x)).toBeCloseTo(3.6, 9);
      expect(loop.radius).toBeCloseTo(3.6, 9);
    });

    it('records the repetition at the end of the stroke, even on a cell crossed earlier', () => {
      // 2, 5, 12, 12, 5, 1, 12, 12, 5, 5: cell 5 is crossed at point 1, repeated at the end.
      const moon = build(BELLE_ALLEE, 'moon');
      const stroke = moon.strokes[0] ?? [];
      expect(endOf(moon).loop.pathIndex).toBe(stroke.length - 1);
      const middle = marksOf(moon, 'loop').find((loop) => loop.lastSegment === undefined);
      expect(middle?.pathIndex).toBe(2);
    });

    describe.each(PLANETS)('as the renderer draws it on %s', (planet) => {
      it.each(WIDTHS)('stays clear of the end bar at width %s', (strokeWidth) => {
        for (const letters of END_LOOP_INTENTIONS) {
          for (const frameCircle of [false, true]) {
            const drawn = renderedDrawing(build(letters, planet), strokeWidth, frameCircle);
            expect(edgeGap(drawn, strokeWidth)).toBeGreaterThan(0);
          }
        }
      });

      it.each(WIDTHS)('stays attached to the last segment at width %s', (strokeWidth) => {
        for (const letters of END_LOOP_INTENTIONS) {
          for (const frameCircle of [false, true]) {
            const drawn = renderedDrawing(build(letters, planet), strokeWidth, frameCircle);
            const { beforeEnd, end, loop } = endOf(drawn);
            const segment = { x: beforeEnd.x - end.x, y: beforeEnd.y - end.y };
            const segmentLength = Math.hypot(segment.x, segment.y);
            const offset = { x: loop.center.x - end.x, y: loop.center.y - end.y };
            const across = Math.abs(segment.x * offset.y - segment.y * offset.x) / segmentLength;
            const along = (segment.x * offset.x + segment.y * offset.y) / segmentLength;
            // Centre one radius from the segment's line, foot of the perpendicular on the segment.
            expect(across).toBeCloseTo(loop.radius, 9);
            expect(along).toBeGreaterThan(0);
            expect(along).toBeLessThan(segmentLength);
          }
        }
      });
    });

    it('keeps a gap equal to the stroke width, up to one reference width', () => {
      for (const strokeWidth of WIDTHS) {
        const drawn = renderedDrawing(build(['A', 'B', 'B'], 'saturn'), strokeWidth, false);
        expect(edgeGap(drawn, strokeWidth)).toBeCloseTo(Math.min(strokeWidth, 1.2), 9);
      }
    });
  });

  describe('marks at other stroke widths', () => {
    it.each(PLANETS)('caps the marks of %s relative to its cell at width 4', (planet) => {
      const cell = 80 / ORDERS[planet];
      const drawn = renderedDrawing(build(['A', 'B', 'B', 'C', 'D', 'D'], planet), 4, false);
      for (const mark of drawn.marks) {
        if (mark.kind === 'loop') expect(2 * mark.radius).toBeLessThanOrEqual(0.45 * cell + 1e-9);
        if (mark.kind === 'start-circle')
          expect(mark.radius).toBeLessThanOrEqual(0.3 * cell + 1e-9);
        if (mark.kind === 'end-bar') expect(mark.length).toBeLessThanOrEqual(0.6 * cell + 1e-9);
      }
    });

    it('lets a loop follow the stroke up to its cap, then stop', () => {
      const [loop] = marksOf(build(['B', 'A', 'J', 'C'], 'saturn'), 'loop');
      if (loop === undefined) throw new Error('Missing loop');
      expect(scaleMark(loop, 0.4)).toMatchObject({ radius: 1.2 });
      expect(scaleMark(loop, 2.4)).toMatchObject({ radius: 6 });
    });

    it('never shrinks a sigil to nothing in the framing circle', () => {
      for (const planet of PLANETS) {
        for (const letters of [...END_LOOP_INTENTIONS, JE_SUIS_CALME]) {
          const sigil = build(letters, planet);
          for (const strokeWidth of WIDTHS) {
            const whole = {
              strokes: sigil.strokes,
              marks: sigil.marks.map((mark) => scaleMark(mark, strokeWidth)),
            };
            const fit = frameFitScale(whole, strokeWidth, frameCenter(sigil.viewBox));
            // Measured at 0.63 at worst; half the size is already a clear failure.
            expect(fit).toBeGreaterThan(0.5);
          }
        }
      }
    });
  });

  describe('business errors', () => {
    it.each([[[]], [['A']]])('refuses fewer than two letters (%j)', (letters) => {
      expect(buildError(letters, 'saturn')).toEqual({
        code: 'TOO_FEW_LETTERS',
        letterCount: letters.length,
      });
    });

    it('refuses letters that all fall on the same cell', () => {
      expect(buildError(['A', 'J', 'S'], 'saturn')).toEqual({ code: 'SINGLE_CELL', number: 1 });
    });

    it('refuses an item that is not a single A–Z letter', () => {
      expect(buildError(['A', 'é', 'B'], 'mars')).toEqual({
        code: 'INVALID_LETTER',
        letter: 'é',
        index: 1,
      });
    });
  });

  it('is deterministic: two calls give deeply equal results', () => {
    expect(buildKameaSigil(JE_SUIS_CALME, 'venus')).toEqual(
      buildKameaSigil(JE_SUIS_CALME, 'venus'),
    );
  });
});
