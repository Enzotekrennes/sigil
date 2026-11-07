/**
 * Chains an export end to end: theme colours → SVG markup → (PNG) → file
 * name → download.
 *
 * Exposes `exportSigilSvg` and `exportSigilPng`. Reads the theme tokens of the
 * page and triggers a browser download; holds no state.
 */
import { downloadBlob } from './download.ts';
import { exportFileName } from './fileName.ts';
import type { SigilMethod } from './fileName.ts';
import { readExportPalette } from './palette.ts';
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
 * Downloads the sigil as a square PNG of `EXPORT_PNG_SIZE` pixels, on the
 * background of the current theme.
 *
 * @param target - Sigil, style settings and method.
 * @param now - Moment of the export, for the file name.
 * @returns Once the download has been handed to the browser.
 * @throws {Error} When a theme colour cannot be read, or rasterising fails
 *   (see `rasterizeSvg`).
 * @remarks Triggers a browser download.
 */
export async function exportSigilPng(target: SigilExport, now: Date = new Date()): Promise<void> {
  const palette = readExportPalette(target.styleOptions.mode);
  // Written at the PNG size so the browser rasterises the vector at full resolution.
  const svg = buildSigilSvg(target.sigil, target.styleOptions, palette, EXPORT_PNG_SIZE);
  const png = await rasterizeSvg(svg, EXPORT_PNG_SIZE);
  downloadBlob(png, exportFileName(target.method, 'png', now));
}
