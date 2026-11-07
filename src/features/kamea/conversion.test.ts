/**
 * Unit tests of the kamea letter → number conversion (decision D2).
 */
import { describe, expect, it } from 'vitest';

import { letterRank, rankToNumber } from './conversion.ts';

describe('letterRank', () => {
  it('ranks A as 1 and Z as 26', () => {
    expect(letterRank('A')).toBe(1);
    expect(letterRank('J')).toBe(10);
    expect(letterRank('Z')).toBe(26);
  });

  it.each(['a', 'É', '1', '', 'AB', ' '])('rejects %j', (input) => {
    expect(letterRank(input)).toBeUndefined();
  });
});

describe('rankToNumber', () => {
  it('applies the Pythagorean reduction on Saturn (9 cells)', () => {
    expect([1, 9, 10, 18, 19, 26].map((rank) => rankToNumber(rank, 9))).toEqual([1, 9, 1, 9, 1, 8]);
  });

  it('wraps Z to 10 on Jupiter (16 cells)', () => {
    expect(rankToNumber(26, 16)).toBe(10);
  });

  it('keeps Z at 26 on the Moon (81 cells)', () => {
    expect(rankToNumber(26, 81)).toBe(26);
  });
});
