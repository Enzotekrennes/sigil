/**
 * Unit tests of the intention normalisation (plan decision D5).
 */
import { describe, expect, it } from 'vitest';

import { normalizeIntention } from './index.ts';

/**
 * Normalises a text expected to be valid and returns its intention; throws,
 * and so fails the calling test, when the text is rejected.
 *
 * @param source - Text containing at least one Latin letter.
 * @returns The normalised intention.
 */
function normalizeValid(source: string) {
  const result = normalizeIntention(source);
  if (!result.ok) {
    throw new Error(`Expected "${source}" to normalise, got ${result.error}`);
  }
  return result.intention;
}

describe('normalizeIntention', () => {
  it('turns « Je suis calme » into the letters JESUISCALME and keeps the source', () => {
    const intention = normalizeValid('Je suis calme');

    expect(intention.letters.join('')).toBe('JESUISCALME');
    expect(intention.source).toBe('Je suis calme');
    expect(intention.ignored).toEqual([]);
  });

  it('gives the same letters whatever the case and punctuation', () => {
    expect(normalizeValid('je suis calme !').letters).toEqual(
      normalizeValid('Je suis calme').letters,
    );
  });

  it('strips accents: « Été » becomes ETE', () => {
    expect(normalizeValid('Été').letters.join('')).toBe('ETE');
  });

  it('strips accents typed as combining marks as well as precomposed ones', () => {
    expect(normalizeValid('été').letters.join('')).toBe('ETE');
    expect(normalizeValid('ça où naïve').letters.join('')).toBe('CAOUNAIVE');
  });

  it('expands the ligatures œ and æ and the German ß', () => {
    expect(normalizeValid('cœur').letters.join('')).toBe('COEUR');
    expect(normalizeValid('ŒUVRE').letters.join('')).toBe('OEUVRE');
    expect(normalizeValid('Lætitia').letters.join('')).toBe('LAETITIA');
    expect(normalizeValid('Straße').letters.join('')).toBe('STRASSE');
  });

  it('drops multiple spaces, tabs and line breaks silently', () => {
    const intention = normalizeValid('  je   suis\tcalme\n');

    expect(intention.letters.join('')).toBe('JESUISCALME');
    expect(intention.ignored).toEqual([]);
  });

  it('reports digits, symbols and emoji as ignored, each once, in order', () => {
    const intention = normalizeValid('paix 2 fois 2 € 🔥');

    expect(intention.letters.join('')).toBe('PAIXFOIS');
    expect(intention.ignored).toEqual(['2', '€', '🔥']);
  });

  it('keeps a composed emoji as a single ignored character', () => {
    const family = '👨‍👩‍👧';
    const thumb = '👍🏽';

    expect(normalizeValid(`ok ${family} ${thumb}`).ignored).toEqual([family, thumb]);
  });

  it('reports letters of other scripts as ignored', () => {
    const intention = normalizeValid('мир peace');

    expect(intention.letters.join('')).toBe('PEACE');
    expect(intention.ignored).toEqual(['м', 'и', 'р']);
  });

  it('rejects an empty intention', () => {
    expect(normalizeIntention('')).toEqual({ ok: false, error: 'EMPTY_INTENTION' });
  });

  it('rejects an intention made only of whitespace or invisible characters', () => {
    expect(normalizeIntention('   \n\t')).toEqual({ ok: false, error: 'EMPTY_INTENTION' });
    expect(normalizeIntention('​')).toEqual({ ok: false, error: 'EMPTY_INTENTION' });
  });

  it('rejects « 123 ! » because it has no Latin letter, listing what was ignored', () => {
    expect(normalizeIntention('123 !')).toEqual({
      ok: false,
      error: 'NO_LATIN_LETTER',
      ignored: ['1', '2', '3'],
    });
  });

  it('rejects punctuation only as having no Latin letter', () => {
    expect(normalizeIntention('?!')).toEqual({ ok: false, error: 'NO_LATIN_LETTER', ignored: [] });
  });
});
