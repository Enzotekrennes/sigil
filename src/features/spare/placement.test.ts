/**
 * Unit tests of the placement of letters in a Spare composition: transforms
 * applied as traced, bounds of every draw, stem sharing, a fixed number of
 * draws per letter, the weighted turns, the spread across a letter's narrow
 * axis, the lead letter of each variant, and the detection of orientations
 * that leave a letter readable as written.
 */
import { describe, expect, it } from 'vitest';

import { mulberry32 } from '../../lib/random.ts';
import type { RandomSource } from '../../lib/random.ts';
import type { Point } from '../sigil/types.ts';
import { getGlyph, isCapitalLetter } from './glyphs/index.ts';
import type { CapitalLetter } from './glyphs/index.ts';
import {
  MAX_CENTRE_OFFSET,
  MAX_LETTER_SCALE,
  MAX_SUPPORT_SCALE,
  MIN_LETTER_SCALE,
  NARROW_AXIS_SPREAD,
  TURN_WEIGHTS,
  composeLetters,
  drawTurn,
  leadLetterFor,
  looksUpright,
} from './placement.ts';
import type { Composition } from './placement.ts';

/** Tolerance on computed coordinates. */
const EPSILON = 1e-9;

/** Lead index outside any word: no letter is drawn at full size. */
const NO_LEAD = -1;

/** Letters with and without vertical stems, to exercise every branch. */
const MIXED_LETTERS: CapitalLetter[] = ['H', 'S', 'L', 'M', 'O', 'T', 'W'];

/**
 * A generator replaying fixed values, to force a given placement.
 *
 * @param values - Values returned in order, each in [0, 1).
 * @returns The scripted generator; it throws when the script runs out.
 */
function scripted(values: readonly number[]): RandomSource {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    if (value === undefined) throw new Error('Scripted random source exhausted');
    return value;
  };
}

/**
 * Lists the vertical segments of one letter in a composition.
 *
 * @param composition - Composed letters.
 * @param letterIndex - Letter to inspect.
 * @param minLength - Shortest segment kept.
 * @returns The x of each vertical segment at least `minLength` long.
 */
function verticalSegmentXs(
  composition: Composition,
  letterIndex: number,
  minLength: number,
): number[] {
  const xs: number[] = [];
  composition.strokes.forEach((stroke, strokeIndex) => {
    if (composition.strokeLetters[strokeIndex] !== letterIndex) return;
    for (let index = 1; index < stroke.length; index += 1) {
      const from = stroke[index - 1];
      const to = stroke[index];
      if (from === undefined || to === undefined) continue;
      if (Math.abs(to.x - from.x) < EPSILON && Math.abs(to.y - from.y) >= minLength)
        xs.push(from.x);
    }
  });
  return xs;
}

describe('composeLetters', () => {
  it('applies mirror, quarter turn, scale and offset in that order, as traced', () => {
    // Mirror (0.1 < 0.5), turn 90° (0.3), smallest scale, centred, no sharing, no lead.
    const composition = composeLetters(['L'], scripted([0.1, 0.3, 0, 0.5, 0.5, 0.9]), NO_LEAD);

    expect(composition.placements).toEqual([
      {
        letter: 'L',
        mirrored: true,
        rotation: 90,
        scale: MIN_LETTER_SCALE,
        offset: { x: 0, y: 0 },
        sharedStemWith: null,
      },
    ]);
    // L's corner (4, 0) in a 12 × 21 box: unit (−6/21, 0.5); mirrored (6/21, 0.5);
    // turned a quarter clockwise (−0.5, 6/21); then scaled.
    const corner = composition.strokes[0]?.[1];
    expect(corner?.x).toBeCloseTo(-0.5 * MIN_LETTER_SCALE, 12);
    expect(corner?.y).toBeCloseTo((6 / 21) * MIN_LETTER_SCALE, 12);
  });

  it('leaves an untransformed letter centred in the unit frame', () => {
    // Not mirrored, no turn (0.8), lead letter at full scale, centred.
    const composition = composeLetters(['I'], scripted([0.9, 0.8, 0.5, 0.5, 0.5, 0.9]), 0);
    const stroke = composition.strokes[0] ?? [];

    expect(stroke[0]?.x).toBeCloseTo(0, 6);
    expect(stroke[0]?.y).toBeCloseTo(-0.5, 6);
    expect(stroke[1]?.y).toBeCloseTo(0.5, 6);
  });

  it('keeps every glyph stroke and records its letter', () => {
    const composition = composeLetters(MIXED_LETTERS, mulberry32(9), 0);
    const expectedOwners = MIXED_LETTERS.flatMap((letter, index) =>
      getGlyph(letter).strokes.map(() => index),
    );

    expect(composition.strokeLetters).toEqual(expectedOwners);
    composition.strokes.forEach((stroke, index) => {
      const letter = MIXED_LETTERS[composition.strokeLetters[index] ?? -1];
      const glyphStroke = letter === undefined ? [] : getGlyph(letter).strokes;
      const ownIndex = composition.strokeLetters
        .slice(0, index)
        .filter((owner) => owner === composition.strokeLetters[index]).length;
      expect(stroke).toHaveLength(glyphStroke[ownIndex]?.length ?? -1);
    });
  });

  it('draws every transform within its bounds and keeps each letter around its offset', () => {
    const lead = 1;
    for (let seed = 0; seed < 200; seed += 1) {
      const composition = composeLetters(MIXED_LETTERS, mulberry32(seed), lead);
      composition.placements.forEach((placement, letterIndex) => {
        expect([0, 90, 180, 270]).toContain(placement.rotation);
        if (letterIndex === lead) {
          expect(placement.scale).toBe(MAX_LETTER_SCALE);
        } else {
          expect(placement.scale).toBeGreaterThanOrEqual(MIN_LETTER_SCALE);
          expect(placement.scale).toBeLessThan(MAX_SUPPORT_SCALE);
        }
        // O reads in any orientation: it stays near the centre.
        const reach =
          placement.letter === 'O' ? MAX_CENTRE_OFFSET : MAX_CENTRE_OFFSET + NARROW_AXIS_SPREAD;
        expect(Math.abs(placement.offset.y)).toBeLessThanOrEqual(reach);
        if (placement.sharedStemWith === null) {
          expect(Math.abs(placement.offset.x)).toBeLessThanOrEqual(reach);
        } else {
          expect(placement.sharedStemWith).toBeLessThan(letterIndex);
        }

        const points: Point[] = composition.strokes
          .filter((_, index) => composition.strokeLetters[index] === letterIndex)
          .flat();
        const halfSize = placement.scale / 2 + EPSILON;
        for (const point of points) {
          expect(Math.abs(point.x - placement.offset.x)).toBeLessThanOrEqual(halfSize);
          expect(Math.abs(point.y - placement.offset.y)).toBeLessThanOrEqual(halfSize);
        }
      });
    }
  });

  it('puts a sharing letter stem on a stem of its anchor letter', () => {
    let shared = 0;
    for (let seed = 0; seed < 200; seed += 1) {
      const composition = composeLetters(MIXED_LETTERS, mulberry32(seed), 0);
      composition.placements.forEach((placement, letterIndex) => {
        if (placement.sharedStemWith === null) return;
        shared += 1;
        const own = verticalSegmentXs(composition, letterIndex, 0.5 * placement.scale);
        const anchorScale = composition.placements[placement.sharedStemWith]?.scale ?? 0;
        const anchor = verticalSegmentXs(composition, placement.sharedStemWith, 0.5 * anchorScale);
        const common = own.some((x) => anchor.some((anchorX) => Math.abs(anchorX - x) < EPSILON));
        expect(common).toBe(true);
      });
    }
    expect(shared).toBeGreaterThan(0);
  });

  it('never shares a stem for letters without vertical lines in any orientation', () => {
    // O, S and W have no straight vertical or horizontal stroke.
    for (let seed = 0; seed < 50; seed += 1) {
      const composition = composeLetters(['O', 'S', 'W'], mulberry32(seed), 0);
      expect(composition.placements.every((placement) => placement.sharedStemWith === null)).toBe(
        true,
      );
    }
  });

  it('reaches all eight orientations of a letter over many draws', () => {
    const orientations = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const [placement] = composeLetters(['F'], mulberry32(seed), 0).placements;
      if (placement)
        orientations.add(`${String(placement.mirrored)}-${String(placement.rotation)}`);
    }
    expect(orientations.size).toBe(8);
  });

  it('consumes exactly six draws per letter', () => {
    let draws = 0;
    const source = mulberry32(1);
    const counting: RandomSource = () => {
      draws += 1;
      return source();
    };
    composeLetters(MIXED_LETTERS, counting, 0);
    expect(draws).toBe(6 * MIXED_LETTERS.length);
  });
});

describe('composeLetters, spread across the narrow axis', () => {
  it('lets a letter laid on its side move further vertically than along its length', () => {
    // L turned 90° (0.3): wide and flat. Offsets drawn at the top of their range.
    const [placement] = composeLetters(
      ['L'],
      scripted([0.9, 0.3, 0.5, 0.999999, 0.999999, 0.9]),
      NO_LEAD,
    ).placements;
    expect(placement?.offset.x).toBeCloseTo(MAX_CENTRE_OFFSET, 4);
    expect(placement?.offset.y ?? 0).toBeGreaterThan(MAX_CENTRE_OFFSET + 0.1);
  });

  it('keeps a letter readable in any orientation near the centre', () => {
    const [placement] = composeLetters(
      ['C'],
      scripted([0.9, 0.3, 0.5, 0.999999, 0.999999, 0.9]),
      NO_LEAD,
    ).placements;
    expect(placement?.offset.x).toBeCloseTo(MAX_CENTRE_OFFSET, 4);
    expect(placement?.offset.y).toBeCloseTo(MAX_CENTRE_OFFSET, 4);
  });
});

describe('drawTurn', () => {
  it('maps a uniform draw onto the weighted turns', () => {
    expect(drawTurn(0)).toBe(90);
    expect(drawTurn(0.374)).toBe(90);
    expect(drawTurn(0.376)).toBe(270);
    expect(drawTurn(0.8)).toBe(0);
    expect(drawTurn(0.99)).toBe(180);
  });

  it('lays three letters out of four on their side', () => {
    const total = TURN_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
    const lying = TURN_WEIGHTS.filter(([turn]) => turn === 90 || turn === 270).reduce(
      (sum, [, weight]) => sum + weight,
      0,
    );
    expect(total).toBeCloseTo(1, 12);
    expect(lying).toBeCloseTo(0.75, 12);
  });
});

describe('leadLetterFor', () => {
  it('gives each variant the next letter in turn', () => {
    const word: CapitalLetter[] = ['J', 'S', 'L', 'M'];
    expect([0, 1, 2, 3, 4].map((variant) => leadLetterFor(word, variant))).toEqual([0, 1, 2, 3, 0]);
  });

  it('never leads with a letter readable in any orientation', () => {
    const word: CapitalLetter[] = ['J', 'S', 'C', 'L', 'M'];
    const leads = [0, 1, 2, 3, 4, 5, 6, 7].map((variant) => word[leadLetterFor(word, variant)]);
    expect(leads).not.toContain('C');
    expect(new Set(leads)).toEqual(new Set(['J', 'S', 'L', 'M']));
  });

  it('falls back to every letter when all read in any orientation', () => {
    expect(leadLetterFor(['O', 'X'], 3)).toBe(1);
  });
});

describe('looksUpright', () => {
  it('flags every letter left untransformed', () => {
    const alphabet = Array.from({ length: 26 }, (_, rank) =>
      String.fromCharCode('A'.charCodeAt(0) + rank),
    ).filter(isCapitalLetter);
    expect(alphabet).toHaveLength(26);
    for (const letter of alphabet) expect(looksUpright(letter, false, 0)).toBe(true);
  });

  it('flags the symmetries of a letter: a reversed M, a Z turned upside down, an O any way', () => {
    expect(looksUpright('M', true, 0)).toBe(true);
    expect(looksUpright('Z', false, 180)).toBe(true);
    expect(looksUpright('O', true, 180)).toBe(true);
  });

  it('does not flag an orientation that changes the letter', () => {
    expect(looksUpright('M', false, 180)).toBe(false);
    expect(looksUpright('P', true, 0)).toBe(false);
    expect(looksUpright('Z', true, 0)).toBe(false);
    expect(looksUpright('L', false, 90)).toBe(false);
  });
});
