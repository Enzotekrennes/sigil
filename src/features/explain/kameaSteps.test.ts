/**
 * Unit tests of the kamea step helpers, including the check that the square
 * drawn by the panel sits exactly under the sigil's path.
 */
import { describe, expect, it } from 'vitest';

import { buildKameaSigil, kameaCellSize, PLANETS } from '../kamea/index.ts';
import { FRAME_MARGIN } from '../sigil/frame.ts';
import type { KameaLetterEntry, Sigil } from '../sigil/types.ts';
import { conversionExample, readKameaSteps, ruleWraps } from './kameaSteps.ts';

/** "Je suis calme" after normalisation. */
const JE_SUIS_CALME = ['J', 'E', 'S', 'U', 'I', 'S', 'C', 'A', 'L', 'M', 'E'];

/**
 * Builds a kamea sigil and fails the test if the builder refused.
 *
 * @param planet - Square to use.
 * @returns The sigil.
 */
function kamea(planet: (typeof PLANETS)[number]): Sigil {
  const result = buildKameaSigil(JE_SUIS_CALME, planet);
  if (!result.ok) throw new Error(`Unexpected kamea error ${result.error.code}`);
  return result.data;
}

describe('readKameaSteps', () => {
  it('finds the three kamea steps', () => {
    const steps = readKameaSteps(kamea('saturn').steps);

    expect(steps?.rule.cellCount).toBe(9);
    expect(steps?.table.entries).toHaveLength(11);
    expect(steps?.path.numbers).toEqual([1, 5, 1, 3, 9, 1, 3, 1, 3, 4, 5]);
  });

  it('returns undefined when a step is missing', () => {
    expect(readKameaSteps(kamea('saturn').steps.slice(1))).toBeUndefined();
  });
});

describe('square drawn by the panel', () => {
  it.each(PLANETS)('puts every visited cell of %s on a point of the path', (planet) => {
    const sigil = kamea(planet);
    const steps = readKameaSteps(sigil.steps);
    const path = sigil.strokes[0] ?? [];
    const order = steps?.path.square.length ?? 0;

    for (const cell of steps?.path.cells ?? []) {
      // Same layout as `KameaGrid`: cells of `kameaCellSize` from the frame margin.
      const size = kameaCellSize(order);
      const center = {
        x: FRAME_MARGIN + (cell.column + 0.5) * size,
        y: FRAME_MARGIN + (cell.row + 0.5) * size,
      };
      const onPath = path.some(
        (point) => Math.abs(point.x - center.x) < 1e-9 && Math.abs(point.y - center.y) < 1e-9,
      );
      expect(onPath).toBe(true);
    }
  });
});

describe('conversionExample', () => {
  const entries: KameaLetterEntry[] = [
    { letter: 'E', rank: 5, number: 5 },
    { letter: 'J', rank: 10, number: 1 },
  ];

  it('prefers the first letter that wraps around the square', () => {
    expect(conversionExample(entries, 9)?.letter).toBe('J');
  });

  it('falls back to the first letter when none wraps', () => {
    expect(conversionExample(entries, 36)?.letter).toBe('E');
  });

  it('returns undefined for an empty table', () => {
    expect(conversionExample([], 9)).toBeUndefined();
  });
});

describe('ruleWraps', () => {
  it('wraps below 26 cells only', () => {
    expect(ruleWraps(25)).toBe(true);
    expect(ruleWraps(36)).toBe(false);
  });
});
