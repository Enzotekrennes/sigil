/**
 * Unit tests of the trace chain behind the "Trace" button: normalisation,
 * single-word rule (D18), kamea or Spare sigil, and the French message of each business error.
 */
import { describe, expect, it } from 'vitest';

import { STRINGS_FR } from './strings.fr.ts';
import { traceErrorMessage, traceKamea, traceSpare } from './trace.ts';
import type { TraceError } from './trace.ts';

describe('traceKamea', () => {
  it('traces "Calme" on Saturn through cells 3,1,3,4,5 (F1)', () => {
    // C 3, A 1, L 12 → 3, M 13 → 4, E 5 on Saturn's 9 cells.
    const result = traceKamea('Calme', 'saturn');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const path = result.sigil.steps.find((step) => step.kind === 'kamea-square-path');
    expect(path?.kind === 'kamea-square-path' && path.numbers).toEqual([3, 1, 3, 4, 5]);
    expect(result.letterCount).toBe(5);
    expect(result.planet).toBe('saturn');
    expect(result.ignored).toEqual([]);
  });

  it('gives deeply equal sigils for the same intention and planet', () => {
    expect(traceKamea('Calme', 'moon')).toEqual(traceKamea('calmé!', 'moon'));
  });

  it('reports characters dropped by the normalisation', () => {
    const result = traceKamea('Calme2026', 'saturn');

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

  it('refuses a sentence of several words, before tracing anything (D18)', () => {
    expect(traceKamea('Je suis calme', 'saturn')).toEqual({
      ok: false,
      error: { code: 'MULTIPLE_WORDS' },
    });
  });

  it('accepts a word with an apostrophe or a hyphen (D18)', () => {
    const result = traceKamea('aujourd’hui', 'moon');

    expect(result.ok && result.letterCount).toBe(10);
    expect(result.ok && result.ignored).toEqual([]);
  });

  it('refuses a word of more than 24 letters, with its count (D18)', () => {
    expect(traceKamea('Anticonstitutionnellement', 'moon')).toEqual({
      ok: false,
      error: { code: 'TOO_LONG', letterCount: 25, maxLetters: 24 },
    });
  });

  it('says a text has no letter rather than asking for one word', () => {
    expect(traceKamea('12 34', 'saturn')).toEqual({
      ok: false,
      error: { code: 'NO_LATIN_LETTER', ignored: ['1', '2', '3', '4'] },
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
  it('keeps T R N Q L of "Tranquillité" and draws a sigil without marks (F2)', () => {
    const result = traceSpare('Tranquillité', { keepVowels: false, variant: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reduction = result.sigil.steps.find((step) => step.kind === 'spare-letter-reduction');
    expect(reduction?.kind === 'spare-letter-reduction' && reduction.kept).toEqual([
      'T',
      'R',
      'N',
      'Q',
      'L',
    ]);
    expect(result.method).toBe('spare');
    expect(result.keptCount).toBe(5);
    expect(result.variant).toBe(0);
    expect(result.sigil.marks).toEqual([]);
  });

  it('gives deeply equal sigils for texts with the same letters (D6)', () => {
    const options = { keepVowels: false, variant: 2 };

    expect(traceSpare('Tranquillité', options)).toEqual(traceSpare('tranquillite!', options));
  });

  it('draws another sigil for another variant', () => {
    const first = traceSpare('Tranquillité', { keepVowels: false, variant: 0 });
    const second = traceSpare('Tranquillité', { keepVowels: false, variant: 1 });

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

  it('refuses a sentence of several words and a word too long, as kamea does (D18)', () => {
    const options = { keepVowels: false, variant: 0 };

    expect(traceSpare('Je suis calme', options)).toEqual({
      ok: false,
      error: { code: 'MULTIPLE_WORDS' },
    });
    expect(traceSpare('Anticonstitutionnellement', options)).toEqual({
      ok: false,
      error: { code: 'TOO_LONG', letterCount: 25, maxLetters: 24 },
    });
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
    [{ code: 'EMPTY_INTENTION' }, /Écrivez une intention.*un seul mot/],
    [
      { code: 'MULTIPLE_WORDS' },
      /^Un seul mot, sans espace : au-delà d’un mot, le sigil devient illisible/,
    ],
    [
      { code: 'TOO_LONG', letterCount: 25, maxLetters: 24 },
      /^Ce mot donne 25 lettres, 24 au plus : au-delà, le sigil devient illisible/,
    ],
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
