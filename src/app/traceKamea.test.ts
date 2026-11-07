/**
 * Unit tests of the trace chain behind the "Trace" button: normalisation,
 * kamea sigil, and the French message of each business error.
 */
import { describe, expect, it } from 'vitest';

import { STRINGS_FR } from './strings.fr.ts';
import { traceErrorMessage, traceKamea } from './traceKamea.ts';
import type { TraceError } from './traceKamea.ts';

describe('traceKamea', () => {
  it('traces "Je suis calme" on Saturn through cells 1,5,1,3,9,1,3,1,3,4,5 (F1)', () => {
    const result = traceKamea('Je suis calme', 'saturn');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const path = result.sigil.steps.find((step) => step.kind === 'kamea-square-path');
    expect(path?.kind === 'kamea-square-path' && path.numbers).toEqual([
      1, 5, 1, 3, 9, 1, 3, 1, 3, 4, 5,
    ]);
    expect(result.letterCount).toBe(11);
    expect(result.planet).toBe('saturn');
    expect(result.ignored).toEqual([]);
  });

  it('gives deeply equal sigils for the same intention and planet', () => {
    expect(traceKamea('Je suis calme', 'moon')).toEqual(traceKamea('je suis calme !', 'moon'));
  });

  it('reports characters dropped by the normalisation', () => {
    const result = traceKamea('Calme 2026', 'saturn');

    expect(result.ok && result.ignored).toEqual(['2', '0', '6']);
  });

  it('refuses an empty intention', () => {
    expect(traceKamea('   ', 'saturn')).toEqual({ ok: false, error: { code: 'EMPTY_INTENTION' } });
  });

  it('refuses an intention without Latin letters, with the ignored characters', () => {
    expect(traceKamea('123 !', 'saturn')).toEqual({
      ok: false,
      error: { code: 'NO_LATIN_LETTER', ignored: ['1', '2', '3'] },
    });
  });

  it('refuses a single letter', () => {
    const result = traceKamea('a', 'saturn');

    expect(!result.ok && result.error.code).toBe('TOO_FEW_LETTERS');
  });

  it('refuses letters that all fall on one cell, naming the planet', () => {
    // A (1) and J (10) both give 1 on Saturn's 9 cells.
    expect(traceKamea('aj', 'saturn')).toEqual({
      ok: false,
      error: { code: 'SINGLE_CELL', number: 1, planet: 'saturn' },
    });
  });
});

describe('traceErrorMessage', () => {
  const cases: readonly [TraceError, RegExp][] = [
    [{ code: 'EMPTY_INTENTION' }, /Écrivez une intention/],
    [
      { code: 'NO_LATIN_LETTER', ignored: ['1'] },
      /Aucune lettre latine à tracer : «\u00a01\u00a0»/,
    ],
    [{ code: 'NO_LATIN_LETTER', ignored: [] }, /lettres A à Z/],
    [{ code: 'TOO_FEW_LETTERS', letterCount: 1, planet: 'saturn' }, /au moins deux lettres/],
    [{ code: 'SINGLE_CELL', number: 1, planet: 'moon' }, /case 1 du carré de la Lune/],
    [{ code: 'INVALID_LETTER', letter: '1', index: 0, planet: 'sun' }, /Modifiez l’intention/],
  ];

  it.each(cases)('words %o for the user', (error, expected) => {
    expect(traceErrorMessage(error, STRINGS_FR)).toMatch(expected);
  });
});
