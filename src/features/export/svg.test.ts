/**
 * Tests of the SVG export builder on real kamea and Spare sigils: a valid,
 * standalone document, one path per stroke, the marks and framing circle of
 * the final drawing, literal colours only, no class, style, animation or
 * intention, and the same geometry as the on-screen renderer.
 */
import { render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildKameaSigil } from '../kamea/index.ts';
import { DEFAULT_STYLE_OPTIONS, SigilRenderer } from '../sigil/index.ts';
import type { Sigil, StyleOptions } from '../sigil/types.ts';
import { buildSpareSigil } from '../spare/index.ts';
import { buildSigilSvg, EXPORT_SVG_SIZE } from './svg.ts';
import type { ExportPalette } from './svg.ts';

/** "Je suis calme" after normalisation. */
const JE_SUIS_CALME = ['J', 'E', 'S', 'U', 'I', 'S', 'C', 'A', 'L', 'M', 'E'];

/** A and J both give 1 on Saturn's square: one loop mark. */
const WITH_LOOP = ['A', 'J', 'B'];

/** Ink-on-paper colours, as `readExportPalette` returns them. */
const PAPER: ExportPalette = {
  background: '#faf7f0',
  stroke: '#1c1914',
  marker: '#1c1914',
  frame: '#1c1914',
};

/** A palette whose four colours differ, to see which element gets which. */
const DISTINCT: ExportPalette = {
  background: '#ffffff',
  stroke: '#111111',
  marker: '#222222',
  frame: '#333333',
};

/**
 * Builds a kamea sigil and fails the test if the builder refused.
 *
 * @param letters - Normalised letters.
 * @returns The Saturn sigil.
 */
function kamea(letters: readonly string[]): Sigil {
  const result = buildKameaSigil(letters, 'saturn');
  if (!result.ok) throw new Error(`Unexpected kamea error ${result.error.code}`);
  return result.data;
}

/**
 * Builds the first Spare variant and fails the test if the builder refused.
 *
 * @param letters - Normalised letters.
 * @returns The Spare sigil.
 */
function spare(letters: readonly string[]): Sigil {
  const result = buildSpareSigil(letters, { keepVowels: false, variant: 0 });
  if (!result.ok) throw new Error(`Unexpected Spare error ${result.error.code}`);
  return result.data;
}

/**
 * Parses SVG markup as XML and fails on a parser error.
 *
 * @param markup - SVG document.
 * @returns The parsed root `<svg>` element.
 */
function parse(markup: string): Element {
  const document = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (document.querySelector('parsererror') !== null) throw new Error('Invalid SVG markup');
  return document.documentElement;
}

/**
 * Builds then parses an export.
 *
 * @param sigil - Sigil to export.
 * @param style - Overrides of the default style settings.
 * @param palette - Colours to write.
 * @returns The parsed root element and the raw markup.
 */
function exported(sigil: Sigil, style: Partial<StyleOptions> = {}, palette = PAPER) {
  const markup = buildSigilSvg(sigil, { ...DEFAULT_STYLE_OPTIONS, ...style }, palette);
  return { root: parse(markup), markup };
}

describe('buildSigilSvg', () => {
  it('writes a standalone square SVG document with a neutral title', () => {
    const { root, markup } = exported(kamea(JE_SUIS_CALME));

    expect(markup.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(root.localName).toBe('svg');
    expect(root.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(root.getAttribute('viewBox')).toBe('0 0 100 100');
    expect(root.getAttribute('width')).toBe(String(EXPORT_SVG_SIZE));
    expect(root.getAttribute('height')).toBe(String(EXPORT_SVG_SIZE));
    expect(root.querySelector('title')?.textContent).toBe('Sigil');
    expect(markup).not.toContain('<!--');
  });

  it('writes the size it is given on the root', () => {
    const markup = buildSigilSvg(kamea(JE_SUIS_CALME), DEFAULT_STYLE_OPTIONS, PAPER, 2048);
    const root = parse(markup);

    expect(root.getAttribute('width')).toBe('2048');
    expect(root.getAttribute('height')).toBe('2048');
  });

  it.each([0, -1, 1.5, Number.NaN])('refuses the size %s', (size) => {
    expect(() => buildSigilSvg(kamea(JE_SUIS_CALME), DEFAULT_STYLE_OPTIONS, PAPER, size)).toThrow(
      RangeError,
    );
  });

  it('fills the whole frame with the background colour first', () => {
    const { root } = exported(kamea(JE_SUIS_CALME));
    const background = root.querySelector('title + rect');

    expect(background?.getAttribute('fill')).toBe(PAPER.background);
    expect(background?.getAttribute('x')).toBe('0');
    expect(background?.getAttribute('y')).toBe('0');
    expect(background?.getAttribute('width')).toBe('100');
    expect(background?.getAttribute('height')).toBe('100');
  });

  it('draws one path per stroke: a single path for kamea, several for Spare', () => {
    const single = kamea(JE_SUIS_CALME);
    const multi = spare(JE_SUIS_CALME);

    expect(exported(single).root.querySelectorAll('path')).toHaveLength(single.strokes.length);
    expect(multi.strokes.length).toBeGreaterThan(1);
    expect(exported(multi).root.querySelectorAll('path')).toHaveLength(multi.strokes.length);
  });

  it('draws the start circle, the strokes, then the other marks, each in its colour', () => {
    const sigil = kamea(WITH_LOOP);
    const { root } = exported(sigil, {}, DISTINCT);
    const ink = Array.from(root.querySelectorAll('g > *'));

    // Start circle, the path, then the loop and the end bar in the model's order.
    expect(ink.map((element) => element.localName)).toEqual(['circle', 'path', 'circle', 'line']);
    expect(ink.map((element) => element.getAttribute('stroke'))).toEqual([
      DISTINCT.marker,
      DISTINCT.stroke,
      DISTINCT.marker,
      DISTINCT.marker,
    ]);
  });

  it('writes the stroke settings on the ink group', () => {
    const round = exported(kamea(JE_SUIS_CALME), { strokeWidth: 2.4 }).root.querySelector('g');
    const flat = exported(kamea(JE_SUIS_CALME), { roundEnds: false }).root.querySelector('g');

    expect(round?.getAttribute('fill')).toBe('none');
    expect(round?.getAttribute('stroke-width')).toBe('2.4');
    expect(round?.getAttribute('stroke-linecap')).toBe('round');
    expect(round?.getAttribute('stroke-linejoin')).toBe('round');
    expect(round?.hasAttribute('stroke-miterlimit')).toBe(false);
    expect(flat?.getAttribute('stroke-linecap')).toBe('butt');
    expect(flat?.getAttribute('stroke-linejoin')).toBe('miter');
    expect(flat?.getAttribute('stroke-miterlimit')).toBe('4');
  });

  it('adds the framing circle last, in the frame colour, only when it is shown', () => {
    const sigil = kamea(JE_SUIS_CALME);
    const framed = exported(sigil, { frameCircle: true }, DISTINCT).root;
    const last = framed.querySelector('g > :last-child');

    expect(last?.localName).toBe('circle');
    expect(last?.getAttribute('r')).toBe('46');
    expect(last?.getAttribute('stroke')).toBe(DISTINCT.frame);
    expect(exported(sigil).root.querySelectorAll('circle')).toHaveLength(1);
    expect(
      exported(sigil, { frameCircle: true, mode: 'stencil' }).root.querySelectorAll('circle'),
    ).toHaveLength(1);
  });

  it.each([
    ['without the framing circle', { strokeWidth: 2 }],
    ['inside the framing circle', { strokeWidth: 2, frameCircle: true }],
    ['with flat ends', { strokeWidth: 0.4, roundEnds: false, frameCircle: true }],
  ])('has the same geometry as the on-screen renderer, %s', (_, style) => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const sigil = kamea(WITH_LOOP);
    const styleOptions = { ...DEFAULT_STYLE_OPTIONS, ...style };
    const { container } = render(
      createElement(SigilRenderer, { sigil, styleOptions, label: 'Sigil' }),
    );
    const screen = container.querySelector('svg');
    const { root } = exported(sigil, style);
    /**
     * Geometry of the drawn elements in drawing order, without presentation.
     *
     * @param svg - An SVG root.
     * @returns Each drawn element's name and geometric attributes.
     */
    const geometry = (svg: Element | null) =>
      Array.from(svg?.querySelector('g')?.children ?? [], (element) =>
        [element.localName, 'd', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2']
          .map((name, index) =>
            index === 0 ? name : `${name}=${element.getAttribute(name) ?? ''}`,
          )
          .join(' '),
      );

    expect(geometry(root)).toEqual(geometry(screen));
  });

  it('writes literal colours only, without class, style, animation or variable', () => {
    for (const markup of [
      exported(kamea(WITH_LOOP), { frameCircle: true }).markup,
      exported(spare(JE_SUIS_CALME), { frameCircle: true }).markup,
    ]) {
      expect(markup).not.toContain('var(');
      expect(markup).not.toMatch(/\sclass=/);
      expect(markup).not.toMatch(/\sstyle=/);
      expect(markup).not.toContain('<style');
      expect(markup).not.toContain('pathLength');
      expect(markup).not.toContain('--trace');
      expect(markup).not.toContain('aria-');
      expect(markup).not.toContain('data-');
      for (const color of markup.matchAll(/(?:stroke|fill)="([^"]*)"/g)) {
        expect(color[1]).toMatch(/^(#[0-9a-f]{6}|none)$/);
      }
    }
  });

  it('never contains the intention, its letters or its explanation steps', () => {
    for (const sigil of [kamea(JE_SUIS_CALME), spare(JE_SUIS_CALME)]) {
      const { root, markup } = exported(sigil);

      expect(markup.toLowerCase()).not.toContain('calme');
      expect(markup.toUpperCase()).not.toContain('JESUISCALME');
      expect(root.querySelectorAll('text, desc, metadata')).toHaveLength(0);
      // The only text node of the document is its neutral title.
      expect(root.textContent.trim()).toBe('Sigil');
    }
  });

  it('escapes colour values instead of breaking the markup', () => {
    const { root } = exported(kamea(JE_SUIS_CALME), {}, { ...PAPER, background: '"><x' });

    expect(root.querySelector('rect')?.getAttribute('fill')).toBe('"><x');
    expect(root.querySelector('x')).toBeNull();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
