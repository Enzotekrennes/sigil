/**
 * Public API of the export feature: the scene's "Export" button and dialog,
 * the SVG builder, the PNG rasteriser, the real-size stencil PDF, the print
 * size rules and the neutral file name.
 */
export { ExportDialog, EXPORT_PNG_SIZES } from './ExportDialog.tsx';
export type { ExportDialogProps, ExportPngSize, ExportStrings } from './ExportDialog.tsx';
export { exportSigilPdf, exportSigilPng, exportSigilSvg } from './exportSigil.ts';
export type { SigilExport, StencilPrint } from './exportSigil.ts';
export { exportFileName } from './fileName.ts';
export type { ExportFormat, SigilMethod } from './fileName.ts';
export { readExportPalette } from './palette.ts';
export {
  A4_MM,
  buildStencilPdf,
  cmToPoints,
  layoutStencilPage,
  mmToPoints,
  PT_PER_MM,
  STENCIL_AREA_MM,
} from './pdf.ts';
export type { PdfPathCommand, PdfText, StencilPage, StencilPdfTexts } from './pdf.ts';
export { EXPORT_PNG_SIZE, rasterizeSvg } from './png.ts';
export {
  MM_PER_CM,
  parsePrintSize,
  PRINT_SIZE_DEFAULT_CM,
  PRINT_SIZE_MAX_CM,
  PRINT_SIZE_MIN_CM,
} from './printSize.ts';
export type { PrintSizeError, PrintSizeResult } from './printSize.ts';
export { buildSigilSvg, EXPORT_SVG_SIZE, EXPORT_SVG_TITLE } from './svg.ts';
export type { ExportPalette } from './svg.ts';
