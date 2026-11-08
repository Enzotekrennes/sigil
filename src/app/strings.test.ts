/**
 * Unit tests of the wording rules of the dictionaries that depend on a
 * value: the Spare simplification sentence in its three cases (fewer, as
 * many, more segments) and the English article before a print size ("an 8 cm
 * print", "a 6.5 cm print"), chosen by how the number is said.
 */
import { describe, expect, it } from 'vitest';

import { STRINGS_EN } from './strings.en.ts';
import { STRINGS_FR } from './strings.fr.ts';

describe('Spare simplification sentence', () => {
  const english = STRINGS_EN.explain.spare.simplificationBody;
  const french = STRINGS_FR.explain.spare.simplificationBody;

  it('says the count drops when overlaps are drawn once', () => {
    expect(english(48, 31)).toContain('48 segments become 31.');
    expect(french(48, 31)).toContain('48 segments deviennent 31.');
  });

  it('says the count is unchanged, without claiming nothing overlapped', () => {
    expect(english(51, 51)).toContain('the sigil still has 51 segments.');
    expect(french(51, 51)).toContain('le sigil compte toujours 51 segments.');
  });

  it('explains a rise by the strokes cut around a shared part, never as a merge result', () => {
    expect(english(52, 53)).toContain('cut around the shared part');
    expect(english(52, 53)).toContain('goes from 52 to 53 segments.');
    expect(english(52, 53)).not.toMatch(/become/);
    expect(french(52, 53)).toContain('on passe de 52 à 53 segments.');
    expect(french(52, 53)).not.toMatch(/deviennent/);
  });

  it('agrees in number with a single segment', () => {
    expect(english(1, 1)).toContain('still has 1 segment.');
    expect(french(1, 2)).toContain('à 2 segments.');
  });
});

describe('stencil help', () => {
  it.each([
    [8, 'an 8'],
    [11, 'an 11'],
    [18, 'an 18'],
    [8.5, 'an 8.5'],
    [1, 'a 1'],
    [6.5, 'a 6.5'],
    [25, 'a 25'],
  ])('uses the article said before %s cm', (size, expected) => {
    expect(STRINGS_EN.style.stencilHelp(size)).toContain(`for ${expected}`);
  });
});
