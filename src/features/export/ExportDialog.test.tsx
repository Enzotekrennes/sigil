/**
 * Component tests of the "Export" button and dialog: disabled without a
 * sigil; the format, PNG resolution and PDF settings; the validation of the
 * print size (message under the field, download blocked); a thumbnail of the
 * file; an SVG download under a neutral name; the loading state keeping the
 * focus; an error message when an export fails.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubNativeDialog } from '../../components/ui/dialogStub.ts';
import { buildKameaSigil } from '../kamea/index.ts';
import { DEFAULT_STYLE_OPTIONS } from '../sigil/index.ts';
import type { Sigil } from '../sigil/types.ts';
import { ExportDialog } from './ExportDialog.tsx';
import type { ExportStrings } from './ExportDialog.tsx';

/** Texts close to the French dictionary, simplified where the test does not read them. */
const STRINGS: ExportStrings = {
  open: 'Exporter',
  title: 'Exporter le sigil',
  formatLegend: 'Format',
  formats: { svg: 'SVG', png: 'PNG', pdf: 'PDF' },
  formatHelp: { svg: 'Vectoriel.', png: 'Image.', pdf: 'Pochoir A4.' },
  resolutionLegend: 'Résolution',
  resolution: (pixels) => `${String(pixels)} px`,
  sizeLabel: 'Taille réelle (cm)',
  sizeHelp: 'De 1 à 25 cm.',
  sizeError: (error) => (error === 'not-a-number' ? 'Écrivez une taille.' : 'Entre 1 et 25 cm.'),
  sizeTooLarge: (max) => `Au plus ${String(max)} cm.`,
  strokeLabel: 'Épaisseur du trait',
  strokeValue: (millimetres) => `${String(millimetres)} mm`,
  strokeHelp: 'De 0,3 à 1,2 mm.',
  preview: (format) => `Aperçu ${format}`,
  cancel: 'Annuler',
  download: 'Télécharger',
  error: (format) => `Export ${format} en échec.`,
  pdf: () => ({ ruler: '1 cm', instruction: 'Imprimer à 100 %.', details: 'Sigil.' }),
};

/** Theme tokens the export reads, declared on the document root. */
const TOKENS = {
  '--color-surface': '#faf7f0',
  '--sigil-stroke': '#1c1914',
  '--sigil-marker': '#1c1914',
  '--sigil-frame': '#1c1914',
  '--stencil-stroke': '#000000',
  '--stencil-bg': '#ffffff',
};

/**
 * Builds the Saturn sigil of some letters.
 *
 * @param letters - Normalised letters.
 * @returns The sigil.
 */
function sigil(letters = ['J', 'E', 'S', 'U', 'I', 'S', 'C', 'A', 'L', 'M', 'E']): Sigil {
  const result = buildKameaSigil(letters, 'saturn');
  if (!result.ok) throw new Error(`Unexpected kamea error ${result.error.code}`);
  return result.data;
}

/**
 * The dialog with its stencil settings held as the screen holds them.
 *
 * @param props - Props of the harness.
 * @param props.shown - The sigil shown, if any.
 * @returns The export button and dialog.
 */
function Harness({ shown }: { readonly shown: Sigil | undefined }) {
  const [strokeMm, setStrokeMm] = useState(0.6);
  const [sizeText, setSizeText] = useState('8');
  return (
    <ExportDialog
      sigil={shown}
      method={shown === undefined ? undefined : 'kamea'}
      styleOptions={DEFAULT_STYLE_OPTIONS}
      strokeMm={strokeMm}
      onStrokeMmChange={setStrokeMm}
      sizeText={sizeText}
      onSizeTextChange={setSizeText}
      strings={STRINGS}
    />
  );
}

/**
 * Opens the dialog from its button, focused first as a keyboard user would.
 *
 * @returns The opener.
 */
function openDialog(): HTMLElement {
  const opener = screen.getByRole('button', { name: 'Exporter' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

/** Blobs handed to `URL.createObjectURL`, in order. */
let blobs: Blob[] = [];
/** Links clicked to start a download, in order. */
let clicked: HTMLAnchorElement[] = [];

beforeEach(() => {
  stubNativeDialog();
  blobs = [];
  clicked = [];
  for (const [name, value] of Object.entries(TOKENS)) {
    document.documentElement.style.setProperty(name, value);
  }
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

describe('ExportDialog', () => {
  it('is a single "Exporter" button, disabled without a sigil', () => {
    render(<Harness shown={undefined} />);

    expect(screen.getByRole('button', { name: 'Exporter' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'SVG' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on SVG with a thumbnail of the file, and offers SVG, PNG and PDF', () => {
    render(<Harness shown={sigil()} />);
    openDialog();

    const dialog = screen.getByRole('dialog', { name: 'Exporter le sigil' });
    expect(screen.getByRole('radio', { name: 'SVG' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'PNG' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'PDF' })).not.toBeChecked();
    const preview = screen.getByRole('img', { name: 'Aperçu SVG' });
    expect(preview.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(preview.getAttribute('src') ?? '')).toContain('stroke="#1c1914"');
    expect(dialog).not.toHaveAttribute('style');
  });

  it('offers the three PNG resolutions, 2048 px by default', () => {
    render(<Harness shown={sigil()} />);
    openDialog();
    fireEvent.click(screen.getByRole('radio', { name: 'PNG' }));

    const resolutions = screen.getByRole('group', { name: 'Résolution' });
    expect(resolutions).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '1024 px' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: '2048 px' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '4096 px' }));
    expect(screen.getByRole('radio', { name: '4096 px' })).toBeChecked();
  });

  it('shows the PDF size and stroke, with a black-on-white stencil thumbnail', () => {
    render(<Harness shown={sigil()} />);
    openDialog();
    fireEvent.click(screen.getByRole('radio', { name: 'PDF' }));

    expect(screen.getByRole('textbox', { name: 'Taille réelle (cm)' })).toHaveValue('8');
    expect(screen.getByRole('slider', { name: 'Épaisseur du trait' })).toHaveValue('0.6');
    const src = decodeURIComponent(
      screen.getByRole('img', { name: 'Aperçu PDF' }).getAttribute('src') ?? '',
    );
    expect(src).toContain('fill="#ffffff"');
    expect(src).toContain('stroke="#000000"');
    expect(screen.getByRole('button', { name: 'Télécharger' })).toBeEnabled();
  });

  it.each([
    ['0,5', 'Entre 1 et 25 cm.'],
    ['26', 'Entre 1 et 25 cm.'],
    ['abc', 'Écrivez une taille.'],
  ])('explains a size of "%s" under the field and blocks the download', (text, message) => {
    render(<Harness shown={sigil()} />);
    openDialog();
    fireEvent.click(screen.getByRole('radio', { name: 'PDF' }));
    const field = screen.getByRole('textbox', { name: 'Taille réelle (cm)' });

    fireEvent.change(field, { target: { value: text } });

    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(expect.stringContaining(message) as string);
    const download = screen.getByRole('button', { name: 'Télécharger' });
    expect(download).toBeDisabled();
    fireEvent.click(download);
    expect(clicked).toHaveLength(0);

    fireEvent.change(field, { target: { value: '6' } });
    expect(field).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByRole('button', { name: 'Télécharger' })).toBeEnabled();
  });

  it('blocks a size the A4 page cannot hold for this sigil, giving the largest that fits', () => {
    render(<Harness shown={sigil(['A', 'B', 'C', 'D'])} />);
    openDialog();
    fireEvent.click(screen.getByRole('radio', { name: 'PDF' }));
    const field = screen.getByRole('textbox', { name: 'Taille réelle (cm)' });

    fireEvent.change(field, { target: { value: '25' } });

    expect(field).toHaveAccessibleDescription(expect.stringContaining('Au plus 19 cm.') as string);
    expect(screen.getByRole('button', { name: 'Télécharger' })).toBeDisabled();
  });

  it('downloads the SVG under a neutral name, closes, and gives the focus back', async () => {
    render(<Harness shown={sigil()} />);
    const opener = openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Télécharger' }));

    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toMatch(/^sigil-kamea-\d{8}-\d{6}\.svg$/);
    expect(await blobs[0]?.text()).toContain('stroke="#1c1914"');
    expect(await screen.findByRole('button', { name: 'Exporter' })).toHaveFocus();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('keeps the focus on a busy download button, ignores a second press, then reports a failure', async () => {
    render(<Harness shown={sigil()} />);
    openDialog();
    fireEvent.click(screen.getByRole('radio', { name: 'PNG' }));
    const download = screen.getByRole('button', { name: 'Télécharger' });
    download.focus();

    // jsdom has no image decoder: rasterising fails as in a browser that cannot decode the SVG.
    fireEvent.click(download);

    expect(download).toHaveAttribute('aria-busy', 'true');
    expect(download).toHaveAttribute('aria-disabled', 'true');
    expect(download).toBeEnabled();
    expect(download).toHaveFocus();
    fireEvent.click(download);
    expect(await screen.findByRole('status')).toHaveTextContent('Export PNG en échec.');
    expect(download).not.toHaveAttribute('aria-busy');
    expect(download).toHaveFocus();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(clicked).toHaveLength(0);
  });

  it('closes on "Annuler" without downloading', () => {
    render(<Harness shown={sigil()} />);
    const opener = openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
    expect(clicked).toHaveLength(0);
  });
});
