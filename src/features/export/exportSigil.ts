/**
 * Chains an export end to end: theme colours → SVG markup → (PNG) → file
 * name → download, or stencil layout → PDF → file name → download.
 *
 * Exposes `exportSigilSvg`, `exportSigilPng`, `exportSigilPdf` and the
 * `StencilPrint` settings. Reads the theme tokens of the page and triggers a
 * browser download; holds no state.
 */
import { downloadBlob } from './download.ts';
import { exportFileName } from './fileName.ts';
import type { SigilMethod } from './fileName.ts';
import { readExportPalette } from './palette.ts';
import { buildStencilPdf, layoutStencilPage } from './pdf.ts';
import type { StencilPdfTexts } from './pdf.ts';
import { EXPORT_PNG_SIZE, rasterizeSvg } from './png.ts';
import { buildSigilSvg } from './svg.ts';
import type { Sigil, StyleOptions } from '../sigil/types.ts';

/** What is exported: the sigil shown, how it is styled, and its method (for the file name). */
export interface SigilExport {
  readonly sigil: Sigil;
  readonly styleOptions: StyleOptions;
  readonly method: SigilMethod;
}

/**
 * Downloads the sigil as an SVG file with the current theme colours.
 *
 * @param target - Sigil, style settings and method.
 * @param now - Moment of the export, for the file name.
 * @throws {Error} When a theme colour cannot be read (see `readExportPalette`).
 * @remarks Triggers a browser download.
 */
export function exportSigilSvg(target: SigilExport, now: Date = new Date()): void {
  const palette = readExportPalette(target.styleOptions.mode);
  const svg = buildSigilSvg(target.sigil, target.styleOptions, palette);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  downloadBlob(blob, exportFileName(target.method, 'svg', now));
}

/**
 * Downloads the sigil as a square PNG, on the background of the current theme
 * (white in stencil mode).
 *
 * @param target - Sigil, style settings and method.
 * @param size - Side of the image in pixels, a positive integer (1024, 2048 or 4096 in the dialog).
 * @param now - Moment of the export, for the file name.
 * @returns Once the download has been handed to the browser.
 * @throws {Error} When a theme colour cannot be read, or rasterising fails
 *   (see `rasterizeSvg`).
 * @remarks Triggers a browser download.
 */
export async function exportSigilPng(
  target: SigilExport,
  size: number = EXPORT_PNG_SIZE,
  now: Date = new Date(),
): Promise<void> {
  const palette = readExportPalette(target.styleOptions.mode);
  // Written at the PNG size so the browser rasterises the vector at full resolution.
  const svg = buildSigilSvg(target.sigil, target.styleOptions, palette, size);
  const png = await rasterizeSvg(svg, size);
  downloadBlob(png, exportFileName(target.method, 'png', now));
}

/** Real-size settings of the stencil PDF. */
export interface StencilPrint {
  /** Stroke on paper, in millimetres (0.3–1.2). */
  readonly strokeMm: number;
  /** Largest dimension of the sigil's ink on paper, in centimetres (1–25). */
  readonly sizeCm: number;
}

/**
 * Downloads the sigil as a real-size tattoo stencil: an A4 portrait PDF in
 * pure black on white, whatever the theme and the screen mode, with a 1 cm
 * control ruler.
 *
 * @param target - Sigil, style settings (only the line ends are used) and method.
 * @param print - Stroke in millimetres and size in centimetres.
 * @param texts - Ruler label and notes, in the interface language.
 * @param now - Moment of the export, for the file name and the PDF dates.
 * @returns Once the download has been handed to the browser.
 * @throws {RangeError} When the sigil does not fit the page at that size.
 * @throws {Error} When the PDF cannot be written (see `buildStencilPdf`).
 * @remarks Triggers a browser download.
 */
export async function exportSigilPdf(
  target: SigilExport,
  print: StencilPrint,
  texts: StencilPdfTexts,
  now: Date = new Date(),
): Promise<void> {
  const page = layoutStencilPage(
    target.sigil,
    target.styleOptions.roundEnds,
    print.strokeMm,
    print.sizeCm,
    texts,
  );
  const bytes = await buildStencilPdf(page, now);
  // Copied into a plain ArrayBuffer-backed view, the only kind a Blob accepts in the DOM typings.
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  downloadBlob(blob, exportFileName(target.method, 'pdf', now));
}
