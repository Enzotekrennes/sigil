/**
 * Unit tests of the deterministic randomness helpers: reference values of
 * cyrb53 and Mulberry32, determinism, seed folding, rough uniformity and the
 * bounds of `randomBetween`.
 */
import { describe, expect, it } from 'vitest';

import { createRandom, cyrb53, mulberry32, randomBetween } from './random.ts';
import type { RandomSource } from './random.ts';

/** Number of draws used by the statistical checks: enough for ±2 % bucket noise. */
const DRAWS = 20000;

/**
 * Mulberry32 exactly as published by its author (C version transcribed to
 * JavaScript by bryc), kept unformatted as an independent oracle for the
 * project's implementation.
 *
 * @param a - Seed.
 * @returns The reference generator.
 */
function referenceMulberry32(a: number): RandomSource {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draws several values from a generator.
 *
 * @param random - Generator.
 * @param count - Number of draws.
 * @returns The values in draw order.
 */
function draw(random: RandomSource, count: number): number[] {
  return Array.from({ length: count }, () => random());
}

describe('cyrb53', () => {
  it.each([
    ['a', 0, 7929297801672961],
    ['b', 0, 8684336938537663],
    ['revenge', 0, 4051478007546757],
    ['revenue', 0, 8309097637345594],
    ['revenue', 1, 8697026808958300],
  ])('hashes "%s" (salt %i) to the published value %i', (text, salt, expected) => {
    expect(cyrb53(text, salt)).toBe(expected);
  });

  it('always returns a non-negative safe integer', () => {
    for (const text of ['', 'J', 'JSCLM', 'é', '🜍', 'x'.repeat(1000)]) {
      const hash = cyrb53(text);
      expect(Number.isSafeInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives unrelated hashes to strings one character apart', () => {
    const hashes = new Set(
      Array.from({ length: 1000 }, (_, index) => cyrb53(`JSCLM|${String(index)}`)),
    );
    expect(hashes.size).toBe(1000);
  });
});

describe('mulberry32', () => {
  it('gives the frozen first values for seed 0 and seed 42', () => {
    expect(draw(mulberry32(0), 3)).toEqual([
      0.26642920868471265, 0.0003297457005828619, 0.2232720274478197,
    ]);
    expect(draw(mulberry32(42), 3)).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
    ]);
  });

  it.each([0, 1, 42, 0x7fffffff, 0xffffffff])(
    'matches the reference implementation over 1000 draws for seed %i',
    (seed) => {
      expect(draw(mulberry32(seed), 1000)).toEqual(draw(referenceMulberry32(seed), 1000));
    },
  );

  it('gives the same sequence to two generators built from the same seed', () => {
    expect(draw(mulberry32(1234), 50)).toEqual(draw(mulberry32(1234), 50));
  });

  it('stays in [0, 1) and fills ten buckets evenly', () => {
    const random = mulberry32(7);
    const buckets = new Array<number>(10).fill(0);
    for (let index = 0; index < DRAWS; index += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      const bucket = Math.floor(value * 10);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    for (const count of buckets) {
      expect(count / DRAWS).toBeGreaterThan(0.09);
      expect(count / DRAWS).toBeLessThan(0.11);
    }
  });
});

describe('createRandom', () => {
  it('uses the seed directly when it fits in 32 bits', () => {
    expect(draw(createRandom(42), 5)).toEqual(draw(mulberry32(42), 5));
  });

  it('keeps the high bits of a 53-bit seed', () => {
    const low = 12345;
    const withHighBits = low + 2 ** 40;
    expect(draw(createRandom(withHighBits), 5)).not.toEqual(draw(createRandom(low), 5));
  });

  it('is deterministic for a cyrb53 seed', () => {
    const seed = cyrb53('spare|JSCLM');
    expect(draw(createRandom(seed), 20)).toEqual(draw(createRandom(seed), 20));
  });
});

describe('randomBetween', () => {
  it('stays within [min, max)', () => {
    const random = mulberry32(3);
    for (let index = 0; index < 1000; index += 1) {
      const value = randomBetween(random, -2.5, 4);
      expect(value).toBeGreaterThanOrEqual(-2.5);
      expect(value).toBeLessThan(4);
    }
  });
});
