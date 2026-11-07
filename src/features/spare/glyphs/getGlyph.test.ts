/**
 * Unit tests of the Spare letter skeletons (plan decision D7): every capital
 * is present, well formed, and matches the Hershey source data.
 */
import { describe, expect, it } from 'vitest';

import { getGlyph, isCapitalLetter } from './index.ts';

/** The 26 letters that must have a glyph. */
const ALPHABET = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index));

/** Height of Roman Simplex capitals in Hershey units, from cap line to baseline. */
const CAP_HEIGHT = 21;

describe('getGlyph', () => {
  it.each(ALPHABET)('gives %s at least one stroke, each of at least two points', (letter) => {
    const glyph = getGlyph(letter);

    expect(glyph.strokes.length).toBeGreaterThan(0);
    for (const stroke of glyph.strokes) {
      expect(stroke.length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(ALPHABET)('keeps every point of %s inside its tight bounds', (letter) => {
    const { strokes, bounds, advance } = getGlyph(letter);
    const points = strokes.flat();
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);

    expect(Math.min(...xs)).toBe(bounds.x);
    expect(Math.min(...ys)).toBe(bounds.y);
    expect(Math.max(...xs)).toBe(bounds.x + bounds.width);
    expect(Math.max(...ys)).toBe(bounds.y + bounds.height);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(advance);
  });

  it.each(ALPHABET)('puts %s on the baseline with its top on the cap line', (letter) => {
    const { strokes } = getGlyph(letter);
    const ys = strokes.flat().map((point) => point.y);

    expect(Math.min(...ys)).toBe(-CAP_HEIGHT);
    // Only the tail of Q goes below the baseline.
    if (letter !== 'Q') expect(Math.max(...ys)).toBe(0);
  });

  it('decodes A as three strokes: two diagonals from the apex and the crossbar', () => {
    // Source record 501: "I[RFJ[ RRFZ[ RMTWT", left bearing I = −9, baseline [ = 9.
    const glyph = getGlyph('A');

    expect(glyph.advance).toBe(18);
    expect(glyph.strokes).toEqual([
      [
        { x: 9, y: -21 },
        { x: 1, y: 0 },
      ],
      [
        { x: 9, y: -21 },
        { x: 17, y: 0 },
      ],
      [
        { x: 4, y: -7 },
        { x: 14, y: -7 },
      ],
    ]);
  });

  it('decodes O as a single closed stroke', () => {
    const [outline, ...others] = getGlyph('O').strokes;

    expect(others).toHaveLength(0);
    expect(outline).toHaveLength(21);
    expect(outline?.at(0)).toEqual(outline?.at(-1));
  });

  it('decodes I as one vertical stroke', () => {
    expect(getGlyph('I').strokes).toEqual([
      [
        { x: 4, y: -21 },
        { x: 4, y: 0 },
      ],
    ]);
  });

  it('matches the stroke counts of the source records for E, M and Q', () => {
    // 505 "LFL[ RLFYF RLPTP RL[Y[", 513 "JFJ[ RJFR[ RZFR[ RZFZ[", 517 outline + " RSWY]".
    expect(getGlyph('E').strokes).toHaveLength(4);
    expect(getGlyph('M').strokes).toHaveLength(4);
    expect(getGlyph('Q').strokes).toHaveLength(2);
  });

  it.each(['a', 'É', '', 'AB', '1', ' '])('refuses %j, which has no glyph', (letter) => {
    expect(() => getGlyph(letter)).toThrow(RangeError);
  });
});

describe('isCapitalLetter', () => {
  it('accepts the 26 capitals only', () => {
    expect(ALPHABET.every(isCapitalLetter)).toBe(true);
    expect(isCapitalLetter('z')).toBe(false);
    expect(isCapitalLetter('ZZ')).toBe(false);
  });
});
