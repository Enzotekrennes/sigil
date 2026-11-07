/**
 * Component tests of the export buttons: disabled without a sigil, an SVG
 * download under a neutral name with the theme colours, and an error message
 * (with the buttons usable again) when an export fails.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildKameaSigil } from '../kamea/index.ts';
import { DEFAULT_STYLE_OPTIONS } from '../sigil/index.ts';
import type { Sigil } from '../sigil/types.ts';
import { ExportActions } from './ExportActions.tsx';
import type { ExportStrings } from './ExportActions.tsx';

/** Texts as the French dictionary gives them, the error simplified. */
const STRINGS: ExportStrings = {
  label: 'Exporter',
  svg: 'SVG',
  png: 'PNG',
  error: (format) => `Export ${format} en échec.`,
};

/** Theme tokens the export reads, declared on the document root. */
const TOKENS = {
  '--color-surface': '#faf7f0',
  '--sigil-stroke': '#1c1914',
  '--sigil-marker': '#1c1914',
  '--sigil-frame': '#1c1914',
};

/**
 * Builds the Saturn sigil of "Je suis calme".
 *
 * @returns The sigil.
 */
function sigil(): Sigil {
  const result = buildKameaSigil(['J', 'E', 'S', 'U', 'I', 'S', 'C', 'A', 'L', 'M', 'E'], 'saturn');
  if (!result.ok) throw new Error(`Unexpected kamea error ${result.error.code}`);
  return result.data;
}

/** Blobs handed to `URL.createObjectURL`, in order. */
let blobs: Blob[] = [];
/** Links clicked to start a download, in order. */
let clicked: HTMLAnchorElement[] = [];

beforeEach(() => {
  blobs = [];
  clicked = [];
  // jsdom has no Blob URLs: record the blobs instead.
  Object.assign(URL, {
    createObjectURL: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:sigil/${String(blobs.length)}`;
    }),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(this);
  });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('style');
});

describe('ExportActions', () => {
  it('groups the buttons under a visible label and disables them without a sigil', () => {
    render(
      <ExportActions
        sigil={undefined}
        method={undefined}
        styleOptions={DEFAULT_STYLE_OPTIONS}
        strings={STRINGS}
      />,
    );

    expect(screen.getByRole('group', { name: 'Exporter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SVG' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'PNG' })).toBeDisabled();
  });

  it('downloads the SVG under a neutral name, with the theme colours', async () => {
    for (const [name, value] of Object.entries(TOKENS)) {
      document.documentElement.style.setProperty(name, value);
    }
    render(
      <ExportActions
        sigil={sigil()}
        method="kamea"
        styleOptions={DEFAULT_STYLE_OPTIONS}
        strings={STRINGS}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'SVG' }));

    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toMatch(/^sigil-kamea-\d{8}-\d{6}\.svg$/);
    expect(clicked[0]?.isConnected).toBe(false);
    expect(blobs[0]?.type).toBe('image/svg+xml');
    const markup = await blobs[0]?.text();
    expect(markup).toContain('fill="#faf7f0"');
    expect(markup).toContain('stroke="#1c1914"');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows an error and downloads nothing when the theme colours cannot be read', () => {
    render(
      <ExportActions
        sigil={sigil()}
        method="kamea"
        styleOptions={DEFAULT_STYLE_OPTIONS}
        strings={STRINGS}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'SVG' }));

    expect(clicked).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('Export SVG en échec.');
    expect(screen.getByRole('button', { name: 'SVG' })).toBeEnabled();
  });

  it('shows an error after a failed PNG export and makes the button usable again', async () => {
    for (const [name, value] of Object.entries(TOKENS)) {
      document.documentElement.style.setProperty(name, value);
    }
    // jsdom has no image decoder: rasterising fails as in a browser that cannot decode the SVG.
    render(
      <ExportActions
        sigil={sigil()}
        method="spare"
        styleOptions={DEFAULT_STYLE_OPTIONS}
        strings={STRINGS}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'PNG' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Export PNG en échec.');
    expect(screen.getByRole('button', { name: 'PNG' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'PNG' })).toHaveAttribute('aria-busy', 'false');
    expect(clicked).toHaveLength(0);
  });
});
