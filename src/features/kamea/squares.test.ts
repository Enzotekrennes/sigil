/**
 * Unit tests of Agrippa's planetary squares: magic sums, completeness, and a
 * sample of values compared with the cited source (De occulta philosophia,
 * book II, ch. 22, as transcribed in the Wikipedia "Magic square" article).
 */
import { describe, expect, it } from 'vitest';

import { KAMEA_SQUARES, PLANETS } from './squares.ts';

/** Expected side of each square, from the source. */
const EXPECTED_ORDER = {
  saturn: 3,
  jupiter: 4,
  mars: 5,
  sun: 6,
  venus: 7,
  mercury: 8,
  moon: 9,
} as const;

describe('KAMEA_SQUARES', () => {
  it('lists the seven planets from the smallest square to the largest', () => {
    expect(PLANETS).toEqual(['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon']);
  });

  describe.each(PLANETS)('%s', (planet) => {
    const square = KAMEA_SQUARES[planet];
    const order = EXPECTED_ORDER[planet];
    const magicSum = (order * (order * order + 1)) / 2;
    const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

    it(`is a ${String(order)}×${String(order)} square`, () => {
      expect(square).toHaveLength(order);
      for (const row of square) expect(row).toHaveLength(order);
    });

    it('holds every number from 1 to N² exactly once', () => {
      const values = square.flat().toSorted((a, b) => a - b);
      expect(values).toEqual(Array.from({ length: order * order }, (_, index) => index + 1));
    });

    it('has the magic sum on every row', () => {
      expect(square.map(sum)).toEqual(Array<number>(order).fill(magicSum));
    });

    it('has the magic sum on every column', () => {
      const columns = square.map((_, column) => square.map((row) => row[column] ?? 0));
      expect(columns.map(sum)).toEqual(Array<number>(order).fill(magicSum));
    });

    it('has the magic sum on both diagonals', () => {
      const main = square.map((row, index) => row[index] ?? 0);
      const anti = square.map((row, index) => row[order - 1 - index] ?? 0);
      expect([sum(main), sum(anti)]).toEqual([magicSum, magicSum]);
    });
  });

  it('matches the source on the first row of each square', () => {
    expect(KAMEA_SQUARES.saturn[0]).toEqual([4, 9, 2]);
    expect(KAMEA_SQUARES.jupiter[0]).toEqual([4, 14, 15, 1]);
    expect(KAMEA_SQUARES.mars[0]).toEqual([11, 24, 7, 20, 3]);
    expect(KAMEA_SQUARES.sun[0]).toEqual([6, 32, 3, 34, 35, 1]);
    expect(KAMEA_SQUARES.venus[0]).toEqual([22, 47, 16, 41, 10, 35, 4]);
    expect(KAMEA_SQUARES.mercury[0]).toEqual([8, 58, 59, 5, 4, 62, 63, 1]);
    expect(KAMEA_SQUARES.moon[0]).toEqual([37, 78, 29, 70, 21, 62, 13, 54, 5]);
  });

  it('matches the source on a sample of inner cells', () => {
    expect(KAMEA_SQUARES.saturn[1]?.[1]).toBe(5);
    expect(KAMEA_SQUARES.mars[2]?.[2]).toBe(13);
    expect(KAMEA_SQUARES.sun[5]).toEqual([36, 5, 33, 4, 2, 31]);
    expect(KAMEA_SQUARES.venus[4]?.[3]).toBe(1);
    expect(KAMEA_SQUARES.mercury[7]).toEqual([64, 2, 3, 61, 60, 6, 7, 57]);
    expect(KAMEA_SQUARES.moon[5]?.[4]).toBe(1);
    expect(KAMEA_SQUARES.moon[3]?.[4]).toBe(81);
  });
});
