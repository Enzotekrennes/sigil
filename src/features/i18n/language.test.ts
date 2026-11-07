/**
 * Unit tests of the first-load language rule (scenario F6): English when the
 * browser's first language is English, French otherwise.
 */
import { describe, expect, it } from 'vitest';

import { detectLanguage, isLanguage } from './language.ts';

describe('detectLanguage', () => {
  it.each([['en'], ['en-US'], ['en-GB'], ['EN-au'], [' en-CA ']])(
    'picks English when the first language is %j',
    (first) => {
      expect(detectLanguage([first, 'fr-FR'])).toBe('en');
    },
  );

  it.each([['fr-FR'], ['fr'], ['de-DE'], ['es'], ['']])(
    'picks French when the first language is %j',
    (first) => {
      expect(detectLanguage([first, 'en-US'])).toBe('fr');
    },
  );

  it('looks at the first language only', () => {
    expect(detectLanguage(['de-DE', 'en-US'])).toBe('fr');
  });

  it('falls back to French on an empty list', () => {
    expect(detectLanguage([])).toBe('fr');
  });
});

describe('isLanguage', () => {
  it('accepts exactly the two interface languages', () => {
    expect(isLanguage('fr')).toBe(true);
    expect(isLanguage('en')).toBe(true);
  });

  it.each([['FR'], ['en-US'], ['de'], [''], [null], [undefined], [1]])('rejects %j', (value) => {
    expect(isLanguage(value)).toBe(false);
  });
});
