/**
 * Unit tests of the bind-rune score: each measure on hand-made drawings
 * (symmetry and balance across the stem, ink, height-to-width ratio,
 * crossings away from the stem, crowding of letters on a common side, mean
 * letter height), the weight of a hatch, and the choice of the lowest penalty.
 */
import { describe, expect, it } from 'vitest';

import type { Point } from '../sigil/types.ts';
import { HATCH_WEIGHT, STEM_X, SYMMETRY_WEIGHTS, chooseRune, scoreRune } from './runeScore.ts';
import type { RuneScore, ScoredLetter } from './runeScore.ts';

/** A vertical stem from y = 10 to y = 90 on the frame's axis. */
const STEM: Point[] = [
  { x: STEM_X, y: 10 },
  { x: STEM_X, y: 90 },
];

/** A chevron opening downwards from the stem, on its right side. */
const RIGHT_ARM: Point[] = [
  { x: STEM_X, y: 30 },
  { x: STEM_X + 15, y: 45 },
];

/** The mirror image of `RIGHT_ARM` across the stem. */
const LEFT_ARM: Point[] = [
  { x: STEM_X, y: 30 },
  { x: STEM_X - 15, y: 45 },
];

/**
 * A letter for the crowding and size terms.
 *
 * @param side - Side of the stem.
 * @param strokes - Its strokes.
 * @returns The letter, its top and bottom taken from its strokes.
 */
function letterOf(side: ScoredLetter['side'], strokes: Point[][]): ScoredLetter {
  const ys = strokes.flat().map((point) => point.y);
  return { side, top: Math.min(...ys), bottom: Math.max(...ys), strokes };
}

/**
 * Scores strokes with no letter, in the symmetric style.
 *
 * @param strokes - Merged polylines.
 * @returns The score.
 */
function score(strokes: Point[][]): RuneScore {
  return scoreRune(strokes, [], 'symmetric');
}

describe('scoreRune', () => {
  it('rates a rune mirrored across the stem as symmetric and balanced', () => {
    const result = score([STEM, RIGHT_ARM, LEFT_ARM]);
    expect(result.symmetry).toBe(1);
    expect(result.imbalance).toBe(0);
  });

  it('rates a one-sided rune as unbalanced and partly symmetric (its stem only)', () => {
    const result = score([STEM, RIGHT_ARM]);
    expect(result.imbalance).toBe(1);
    expect(result.symmetry).toBeGreaterThan(0.7);
    expect(result.symmetry).toBeLessThan(0.9);
  });

  it('weighs asymmetry by the style of the variant', () => {
    const strokes = [STEM, RIGHT_ARM];
    const symmetric = scoreRune(strokes, [], 'symmetric');
    const paired = scoreRune(strokes, [], 'paired');
    expect(symmetric.penalty - paired.penalty).toBeCloseTo(
      (SYMMETRY_WEIGHTS.symmetric - SYMMETRY_WEIGHTS.paired) * (1 - symmetric.symmetry),
    );
  });

  it('measures ink against the side of the drawing area, and the height-to-width ratio', () => {
    const result = score([STEM, RIGHT_ARM, LEFT_ARM]);
    expect(result.ink).toBeCloseTo((80 + 2 * 15 * Math.SQRT2) / 80);
    expect(result.aspectRatio).toBeCloseTo(80 / 30);
  });

  it('counts crossings away from the stem, not those on it', () => {
    const cross = [
      [
        { x: 55, y: 50 },
        { x: 65, y: 60 },
      ],
      [
        { x: 65, y: 50 },
        { x: 55, y: 60 },
      ],
    ];
    const throughStem = [
      { x: 40, y: 70 },
      { x: 60, y: 70 },
    ];
    expect(score([STEM, ...cross, throughStem]).crossings).toBe(1);
  });

  it('counts each hatch with its heavy weight', () => {
    const clean = score([STEM, RIGHT_ARM, LEFT_ARM]);
    const hatched = score([
      STEM,
      RIGHT_ARM,
      LEFT_ARM,
      [
        { x: 52, y: 60 },
        { x: 52, y: 80 },
      ],
    ]);
    expect(hatched.hatches).toBe(1);
    expect(hatched.penalty).toBeGreaterThan(clean.penalty + HATCH_WEIGHT - 1);
  });

  it('measures crowding only between letters on a common side', () => {
    const upper = letterOf('right', [
      [
        { x: 50, y: 30 },
        { x: 70, y: 50 },
      ],
    ]);
    const lower = letterOf('right', [
      [
        { x: 50, y: 40 },
        { x: 70, y: 60 },
      ],
    ]);
    const facing = letterOf('left', [
      [
        { x: 50, y: 40 },
        { x: 30, y: 60 },
      ],
    ]);
    expect(scoreRune([STEM], [upper, lower], 'mixed').crowding).toBeCloseTo(0.5);
    expect(scoreRune([STEM], [upper, facing], 'mixed').crowding).toBe(0);
  });

  it('measures the mean letter height', () => {
    const letters = [
      letterOf('right', [
        [
          { x: 50, y: 20 },
          { x: 60, y: 40 },
        ],
      ]),
      letterOf('left', [
        [
          { x: 50, y: 50 },
          { x: 40, y: 80 },
        ],
      ]),
    ];
    expect(scoreRune([STEM], letters, 'mixed').letterHeight).toBe(25);
  });
});

describe('chooseRune', () => {
  it('picks the lowest penalty, the first one on a tie', () => {
    const at = (penalty: number): RuneScore => ({ ...score([STEM]), penalty });
    expect(chooseRune([at(3), at(1), at(2), at(1)])).toBe(1);
    expect(chooseRune([at(0)])).toBe(0);
  });
});
