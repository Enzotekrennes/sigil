/**
 * Tests of the print size field of the stencil PDF (F5): decimals with a
 * point or a comma, the 1–25 cm range, and what is refused and why.
 */
import { describe, expect, it } from 'vitest';

import {
  parsePrintSize,
  PRINT_SIZE_DEFAULT_CM,
  PRINT_SIZE_MAX_CM,
  PRINT_SIZE_MIN_CM,
} from './printSize.ts';

describe('parsePrintSize', () => {
  it.each([
    ['8', 8],
    ['6,5', 6.5],
    ['6.5', 6.5],
    [' 12 ', 12],
    ['1', 1],
    ['25', 25],
    ['25,0', 25],
  ])('reads "%s" as %s cm', (text, centimetres) => {
    expect(parsePrintSize(text)).toEqual({ ok: true, centimetres });
  });

  it.each(['0', '0,9', '25,1', '30', '100'])('refuses "%s", out of the 1–25 cm range', (text) => {
    expect(parsePrintSize(text)).toEqual({ ok: false, error: 'out-of-range' });
  });

  it.each(['', ' ', 'abc', '-3', '6,5,2', '6 cm', '1e1', ',5'])(
    'refuses "%s", not a number of centimetres',
    (text) => {
      expect(parsePrintSize(text)).toEqual({ ok: false, error: 'not-a-number' });
    },
  );

  it('offers the design default, within the range', () => {
    expect(PRINT_SIZE_DEFAULT_CM).toBe(8);
    expect(PRINT_SIZE_MIN_CM).toBe(1);
    expect(PRINT_SIZE_MAX_CM).toBe(25);
  });
});
