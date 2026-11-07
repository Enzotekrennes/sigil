/**
 * Unit tests of the trace chain behind the "Trace" button: normalisation,
 * kamea or Spare sigil, and the French message of each business error.
 */
import { describe, expect, it } from 'vitest';

import { STRINGS_FR } from './strings.fr.ts';
import { traceErrorMessage, traceKamea, traceSpare } from './trace.ts';
import type { TraceError } from './trace.ts';

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

describe('traceSpare', () => {
  it('keeps J S C L M of "Je suis calme" and draws a sigil without marks (F2)', () => {
    const result = traceSpare('Je suis calme', { keepVowels: false, variant: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reduction = result.sigil.steps.find((step) => step.kind === 'spare-letter-reduction');
    expect(reduction?.kind === 'spare-letter-reduction' && reduction.kept).toEqual([
      'J',
      'S',
      'C',
      'L',
      'M',
    ]);
    expect(result.method).toBe('spare');
    expect(result.keptCount).toBe(5);
    expect(result.variant).toBe(0);
    expect(result.sigil.marks).toEqual([]);
  });

  it('gives deeply equal sigils for texts with the same letters (D6)', () => {
    const options = { keepVowels: false, variant: 2 };

    expect(traceSpare('Je suis calme', options)).toEqual(traceSpare('je suis calme !', options));
  });

  it('draws another sigil for another variant', () => {
    const first = traceSpare('Je suis calme', { keepVowels: false, variant: 0 });
    const second = traceSpare('Je suis calme', { keepVowels: false, variant: 1 });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.sigil.strokes).not.toEqual(first.sigil.strokes);
  });

  it('suggests keeping the vowels when only vowels are left out', () => {
    expect(traceSpare('oui', { keepVowels: false, variant: 0 })).toEqual({
      ok: false,
      error: { code: 'NO_LETTER_LEFT', suggestKeepVowels: true },
    });
    expect(traceSpare('oui', { keepVowels: true, variant: 0 }).ok).toBe(true);
  });

  it('refuses an intention without Latin letters, as kamea does', () => {
    expect(traceSpare('123 !', { keepVowels: false, variant: 0 })).toEqual({
      ok: false,
      error: { code: 'NO_LATIN_LETTER', ignored: ['1', '2', '3'] },
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
    [
      { code: 'NO_LETTER_LEFT', suggestKeepVowels: true },
      /Sans ses voyelles.*Gardez les voyelles pour la tracer/,
    ],
    [{ code: 'NO_LETTER_LEFT', suggestKeepVowels: false }, /une fois les doublons retirés/],
    [{ code: 'INVALID_VARIANT', variant: -1 }, /Modifiez l’intention/],
  ];

  it.each(cases)('words %o for the user', (error, expected) => {
    expect(traceErrorMessage(error, STRINGS_FR)).toMatch(expected);
  });
});
