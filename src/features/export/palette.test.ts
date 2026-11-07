/**
 * Tests of the export palette: which token each colour comes from in screen
 * and stencil modes, and the refusal of anything that is not a literal colour.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { readExportPalette } from './palette.ts';

/**
 * Declares token values on an element, as the stylesheet would on `:root`.
 *
 * @param tokens - Custom property names mapped to their values.
 * @returns The element, attached to the document.
 */
function themed(tokens: Readonly<Record<string, string>>): HTMLElement {
  const element = document.createElement('div');
  for (const [name, value] of Object.entries(tokens)) element.style.setProperty(name, value);
  document.body.append(element);
  return element;
}

/** Tokens of a theme whose colours all differ. */
const TOKENS = {
  '--color-surface': ' #faf7f0',
  '--sigil-stroke': '#1c1914',
  '--sigil-marker': '#2c2924',
  '--sigil-frame': 'rgb(1 2 3)',
  '--stencil-stroke': '#000000',
  '--stencil-bg': '#ffffff',
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('readExportPalette', () => {
  it('reads the scene colours of the current theme in screen mode', () => {
    expect(readExportPalette('screen', themed(TOKENS))).toEqual({
      background: '#faf7f0',
      stroke: '#1c1914',
      marker: '#2c2924',
      frame: 'rgb(1 2 3)',
    });
  });

  it('reads black on white in stencil mode, whatever the theme', () => {
    expect(readExportPalette('stencil', themed(TOKENS))).toEqual({
      background: '#ffffff',
      stroke: '#000000',
      marker: '#000000',
      frame: '#000000',
    });
  });

  it.each([
    ['missing', { ...TOKENS, '--sigil-stroke': '' }],
    ['unresolved', { ...TOKENS, '--sigil-stroke': 'var(--color-text)' }],
    ['not a colour', { ...TOKENS, '--sigil-stroke': 'url(https://example.test/x)' }],
  ])('refuses a %s token', (_, tokens) => {
    expect(() => readExportPalette('screen', themed(tokens))).toThrow(/--sigil-stroke/);
  });
});
