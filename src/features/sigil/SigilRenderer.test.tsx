/**
 * Component tests of SigilRenderer on real kamea sigils: SVG structure,
 * marks, style settings, fitting inside the framing circle, accessible name,
 * absence of the intention, reduced motion, step-by-step drawing, and when
 * the tracing animation restarts.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildKameaSigil } from '../kamea/index.ts';
import { SigilRenderer } from './SigilRenderer.tsx';
import { DEFAULT_STYLE_OPTIONS, MARK_REFERENCE_STROKE_WIDTH } from './style.ts';
import type { Planet, Sigil, StyleOptions } from './types.ts';

/** "Je suis calme" after normalisation: no repeated number on Saturn, so no loop. */
const JE_SUIS_CALME = ['J', 'E', 'S', 'U', 'I', 'S', 'C', 'A', 'L', 'M', 'E'];

/** A and J both give 1 on Saturn's square: one loop, then B (2). */
const WITH_LOOP = ['A', 'J', 'B'];

/** Accessible name given by the parent, never the intention. */
const LABEL = 'Sigil';

/**
 * Builds a kamea sigil and fails the test if the builder refused.
 *
 * @param letters - Normalised letters.
 * @param planet - Square to use.
 * @returns The sigil.
 */
function kamea(letters: readonly string[], planet: Planet = 'saturn'): Sigil {
  const result = buildKameaSigil(letters, planet);
  if (!result.ok) throw new Error(`Unexpected kamea error ${result.error.code}`);
  return result.data;
}

/**
 * Replaces `window.matchMedia` so the reduced motion query answers `reduced`.
 *
 * @param reduced - Whether the user prefers reduced motion.
 */
function mockReducedMotion(reduced: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduced && query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/**
 * Finds the group that carries the stroke settings and the animation run.
 *
 * @param svg - Rendered sigil.
 * @returns The ink group.
 */
function inkOf(svg: Element): Element {
  const ink = svg.querySelector('.sigil-renderer__ink');
  if (ink === null) throw new Error('Ink group not rendered');
  return ink;
}

/**
 * Renders a sigil with the given style overrides.
 *
 * @param sigil - Sigil to draw.
 * @param style - Overrides of the default style settings.
 * @returns The rendered `<svg>` and the render result.
 */
function renderSigil(sigil: Sigil, style: Partial<StyleOptions> = {}) {
  const result = render(
    <SigilRenderer
      sigil={sigil}
      styleOptions={{ ...DEFAULT_STYLE_OPTIONS, ...style }}
      label={LABEL}
    />,
  );
  return { svg: screen.getByRole('img', { name: LABEL }), ...result };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SigilRenderer structure', () => {
  it('renders an accessible image in the model view box', () => {
    const { svg } = renderSigil(kamea(JE_SUIS_CALME));

    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 100 100');
    expect(svg).toHaveAttribute('aria-label', LABEL);
  });

  it('draws one path per polyline, its points in tracing order', () => {
    const sigil = kamea(JE_SUIS_CALME);
    const { svg } = renderSigil(sigil);

    const paths = svg.querySelectorAll('path.sigil-renderer__stroke');
    expect(paths).toHaveLength(sigil.strokes.length);
    const d = paths[0]?.getAttribute('d') ?? '';
    expect(d.match(/M/g)).toHaveLength(1);
    expect(d.match(/L/g)).toHaveLength((sigil.strokes[0]?.length ?? 0) - 1);
    expect(d.startsWith('M50 76.667L')).toBe(true);
  });

  it('draws the start circle and the end bar of a sigil without repetition', () => {
    const { svg } = renderSigil(kamea(JE_SUIS_CALME));

    expect(svg.querySelectorAll('[data-mark="start-circle"]')).toHaveLength(1);
    expect(svg.querySelectorAll('[data-mark="end-bar"]')).toHaveLength(1);
    expect(svg.querySelectorAll('[data-mark="loop"]')).toHaveLength(0);
  });

  it('draws one loop per run of repeated numbers', () => {
    const sigil = kamea(WITH_LOOP);
    const { svg } = renderSigil(sigil);

    expect(svg.querySelectorAll('.sigil-renderer__mark')).toHaveLength(sigil.marks.length);
    expect(svg.querySelectorAll('[data-mark="loop"]')).toHaveLength(1);
  });

  it('never writes the intention in the SVG markup', () => {
    const { svg } = renderSigil(kamea(JE_SUIS_CALME));

    expect(svg.outerHTML).not.toMatch(/JESUISCALME|je suis calme/i);
  });
});

describe('SigilRenderer style settings', () => {
  it('applies the stroke width and round ends by default', () => {
    const { svg } = renderSigil(kamea(JE_SUIS_CALME));
    const ink = inkOf(svg);

    expect(ink).toHaveAttribute('stroke-width', '1.2');
    expect(ink).toHaveAttribute('stroke-linecap', 'round');
    expect(ink).toHaveAttribute('stroke-linejoin', 'round');
    expect(ink).not.toHaveAttribute('stroke-miterlimit');
  });

  it('applies flat ends with mitred joins and a custom width', () => {
    const { svg } = renderSigil(kamea(JE_SUIS_CALME), { strokeWidth: 3, roundEnds: false });
    const ink = inkOf(svg);

    expect(ink).toHaveAttribute('stroke-width', '3');
    expect(ink).toHaveAttribute('stroke-linecap', 'butt');
    expect(ink).toHaveAttribute('stroke-linejoin', 'miter');
    expect(ink).toHaveAttribute('stroke-miterlimit', '4');
  });

  it('draws the framing circle only when asked, centred, radius 46', () => {
    const sigil = kamea(JE_SUIS_CALME);

    const without = renderSigil(sigil);
    expect(without.svg.querySelector('.sigil-renderer__frame')).toBeNull();
    without.unmount();

    const { svg } = renderSigil(sigil, { frameCircle: true });
    const frame = svg.querySelector('.sigil-renderer__frame');
    expect(frame).toHaveAttribute('cx', '50');
    expect(frame).toHaveAttribute('cy', '50');
    expect(frame).toHaveAttribute('r', '46');
  });

  it('drops the framing circle and uses stencil colours in stencil mode', () => {
    const { svg } = renderSigil(kamea(JE_SUIS_CALME), { frameCircle: true, mode: 'stencil' });

    expect(svg.querySelector('.sigil-renderer__frame')).toBeNull();
    expect(svg).toHaveClass('sigil-renderer--stencil');
  });

  it('resizes the marks with the stroke width, below their cap', () => {
    const sigil = kamea(WITH_LOOP);
    const start = sigil.marks.find((mark) => mark.kind === 'start-circle');
    const loop = sigil.marks.find((mark) => mark.kind === 'loop');
    if (start === undefined || loop === undefined) throw new Error('Expected marks');

    const { svg } = renderSigil(sigil, { strokeWidth: MARK_REFERENCE_STROKE_WIDTH * 1.5 });

    const startRadius = Number(svg.querySelector('[data-mark="start-circle"]')?.getAttribute('r'));
    const loopRadius = Number(svg.querySelector('[data-mark="loop"]')?.getAttribute('r'));
    expect(startRadius).toBeCloseTo(start.radius * 1.5, 2);
    expect(loopRadius).toBeCloseTo(loop.radius * 1.5, 2);

    const bar = svg.querySelector('[data-mark="end-bar"]');
    const barLength = Math.hypot(
      Number(bar?.getAttribute('x2')) - Number(bar?.getAttribute('x1')),
      Number(bar?.getAttribute('y2')) - Number(bar?.getAttribute('y1')),
    );
    const endBar = sigil.marks.find((mark) => mark.kind === 'end-bar');
    expect(barLength).toBeCloseTo((endBar?.length ?? 0) * 1.5, 2);
  });

  it('stops a kamea loop at its cap relative to the cell', () => {
    // Saturn cells are 26.7 wide: a loop never exceeds 45 % of that in diameter.
    const { svg } = renderSigil(kamea(WITH_LOOP), { strokeWidth: 4 });

    const loopRadius = Number(svg.querySelector('[data-mark="loop"]')?.getAttribute('r'));
    expect(loopRadius).toBeCloseTo((0.45 * 80) / 3 / 2, 2);
  });

  it('keeps the shape when the style changes', () => {
    const sigil = kamea(JE_SUIS_CALME);
    const { svg, rerender } = renderSigil(sigil);
    const before = svg.querySelector('path')?.getAttribute('d');

    rerender(
      <SigilRenderer
        sigil={sigil}
        styleOptions={{ ...DEFAULT_STYLE_OPTIONS, strokeWidth: 4, roundEnds: false }}
        label={LABEL}
      />,
    );

    expect(svg.querySelector('path')?.getAttribute('d')).toBe(before);
  });
});

describe('SigilRenderer animation', () => {
  it('traces the strokes in path order when motion is allowed', () => {
    mockReducedMotion(false);
    const { svg } = renderSigil(kamea(JE_SUIS_CALME));

    expect(svg).toHaveClass('sigil-renderer--trace');
    const path = svg.querySelector('path.sigil-renderer__stroke');
    expect(path).toHaveAttribute('pathLength', '1');
    expect(path?.getAttribute('style')).toContain('--trace-share: 1');
    expect(path?.getAttribute('style')).toContain('--trace-offset: 0');
  });

  it('also traces when matchMedia is unavailable', () => {
    const { svg } = renderSigil(kamea(JE_SUIS_CALME));

    expect(svg).toHaveClass('sigil-renderer--trace');
  });

  it('shows the final sigil without tracing under reduced motion', () => {
    mockReducedMotion(true);
    const { svg } = renderSigil(kamea(JE_SUIS_CALME, 'moon'), { frameCircle: true });

    expect(svg).toHaveClass('sigil-renderer--static');
    expect(svg).not.toHaveClass('sigil-renderer--trace');
    for (const element of svg.querySelectorAll('path, .sigil-renderer__frame')) {
      expect(element).not.toHaveAttribute('pathLength');
      expect(element).not.toHaveAttribute('style');
    }
  });

  it('does not restart the tracing when only the style changes', () => {
    mockReducedMotion(false);
    const sigil = kamea(JE_SUIS_CALME);
    const { svg, rerender } = renderSigil(sigil);
    const pathBefore = svg.querySelector('path');
    const runBefore = inkOf(svg).getAttribute('data-run');

    rerender(
      <SigilRenderer
        sigil={sigil}
        styleOptions={{ ...DEFAULT_STYLE_OPTIONS, strokeWidth: 2.4, frameCircle: true }}
        label={LABEL}
      />,
    );

    expect(svg.querySelector('path')).toBe(pathBefore);
    expect(inkOf(svg).getAttribute('data-run')).toBe(runBefore);
  });

  it('restarts the tracing for a new sigil, even an identical one', () => {
    mockReducedMotion(false);
    const { svg, rerender } = renderSigil(kamea(JE_SUIS_CALME));
    const pathBefore = svg.querySelector('path');
    const runBefore = inkOf(svg).getAttribute('data-run');

    rerender(
      <SigilRenderer
        sigil={kamea(JE_SUIS_CALME)}
        styleOptions={DEFAULT_STYLE_OPTIONS}
        label={LABEL}
      />,
    );

    expect(svg.querySelector('path')).not.toBe(pathBefore);
    expect(inkOf(svg).getAttribute('data-run')).not.toBe(runBefore);
  });

  it('restarts the tracing of the same sigil when the replay token changes', () => {
    mockReducedMotion(false);
    const sigil = kamea(JE_SUIS_CALME);
    const { svg, rerender } = renderSigil(sigil);
    const pathBefore = svg.querySelector('path');

    rerender(
      <SigilRenderer
        sigil={sigil}
        styleOptions={DEFAULT_STYLE_OPTIONS}
        label={LABEL}
        replayToken={1}
      />,
    );

    expect(svg.querySelector('path')).not.toBe(pathBefore);
  });
});

describe('SigilRenderer framing circle', () => {
  /**
   * Farthest point of the drawn path from the frame centre.
   *
   * @param svg - Rendered sigil.
   * @returns Largest distance of a path vertex from (50, 50).
   */
  function pathReach(svg: Element): number {
    const d = svg.querySelector('path.sigil-renderer__stroke')?.getAttribute('d') ?? '';
    const numbers = (d.match(/-?[\d.]+/g) ?? []).map(Number);
    let reach = 0;
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      reach = Math.max(
        reach,
        Math.hypot((numbers[index] ?? 50) - 50, (numbers[index + 1] ?? 50) - 50),
      );
    }
    return reach;
  }

  it('shrinks a sigil that reaches the corners so it fits inside the circle', () => {
    // On the Moon, E (5) sits in the top-right corner cell, about 50 from the centre.
    const sigil = kamea(['A', 'E'], 'moon');
    const without = renderSigil(sigil);
    const reachWithout = pathReach(without.svg);
    without.unmount();

    const { svg } = renderSigil(sigil, { frameCircle: true });

    expect(reachWithout).toBeGreaterThan(46);
    expect(pathReach(svg) + 1.2 / 2).toBeLessThanOrEqual(46 - 1.2 / 2 - 2 * 1.2 + 1e-3);
    expect(inkOf(svg)).toHaveAttribute('stroke-width', '1.2');
  });

  it('shows a circle turned on after the tracing started at once, without tracing it', () => {
    mockReducedMotion(false);
    const sigil = kamea(JE_SUIS_CALME);
    const { svg, rerender } = renderSigil(sigil);

    rerender(
      <SigilRenderer
        sigil={sigil}
        styleOptions={{ ...DEFAULT_STYLE_OPTIONS, frameCircle: true }}
        label={LABEL}
      />,
    );

    const frame = svg.querySelector('.sigil-renderer__frame');
    expect(frame).toHaveClass('sigil-renderer__frame--settled');
    expect(frame).not.toHaveAttribute('pathLength');
  });

  it('traces the circle last when it is on from the start of the run', () => {
    mockReducedMotion(false);
    const { svg } = renderSigil(kamea(JE_SUIS_CALME), { frameCircle: true });

    const frame = svg.querySelector('.sigil-renderer__frame');
    expect(frame).not.toHaveClass('sigil-renderer__frame--settled');
    expect(frame).toHaveAttribute('pathLength', '1');
  });
});

describe('SigilRenderer step by step', () => {
  it('draws only the revealed segments, still, without end bar nor framing circle', () => {
    mockReducedMotion(true);
    const sigil = kamea(JE_SUIS_CALME);
    const { container } = render(
      <SigilRenderer
        sigil={sigil}
        styleOptions={{ ...DEFAULT_STYLE_OPTIONS, frameCircle: true }}
        label={LABEL}
        revealedSteps={2}
      />,
    );
    const svg = screen.getByRole('img', { name: LABEL });

    const d = svg.querySelector('path')?.getAttribute('d') ?? '';
    expect(d.match(/L/g)).toHaveLength(2);
    expect(svg.querySelector('[data-mark="start-circle"]')).not.toBeNull();
    expect(svg.querySelector('[data-mark="end-bar"]')).toBeNull();
    expect(svg.querySelector('.sigil-renderer__frame')).toBeNull();
    expect(container.querySelector('[pathLength]')).toBeNull();
  });

  it('draws the whole sigil at the last step', () => {
    mockReducedMotion(true);
    const sigil = kamea(JE_SUIS_CALME);
    render(
      <SigilRenderer
        sigil={sigil}
        styleOptions={DEFAULT_STYLE_OPTIONS}
        label={LABEL}
        revealedSteps={10}
      />,
    );
    const svg = screen.getByRole('img', { name: LABEL });

    expect(svg.querySelector('path')?.getAttribute('d')?.match(/L/g)).toHaveLength(10);
    expect(svg.querySelector('[data-mark="end-bar"]')).not.toBeNull();
  });
});
