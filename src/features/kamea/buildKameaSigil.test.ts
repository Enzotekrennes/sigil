/**
 * Unit tests of the kamea sigil builder: conversion per planet, path through
 * the right cells, start / end / loop marks, explanation steps, business
 * errors and determinism.
 */
import { describe, expect, it } from 'vitest';

import type { Mark, Point, Sigil } from '../sigil/types.ts';
import { buildKameaSigil } from './buildKameaSigil.ts';
import type { KameaError } from './buildKameaSigil.ts';
import type { Planet } from '../sigil/types.ts';

/** "Je suis calme" after normalisation. */
const JE_SUIS_CALME = ['J', 'E', 'S', 'U', 'I', 'S', 'C', 'A', 'L', 'M', 'E'];

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
      expect(marksOf(sigil, 'start-circle')).toEqual([
        { kind: 'start-circle', center: center(2, 1, 3), radius: 3 },
      ]);
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
    ])('is perpendicular to the last segment (%s)', (_, letters, planet) => {
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
      expect(bar.length).toBeCloseTo(9.6, 9);
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
