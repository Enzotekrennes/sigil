/**
 * "Export" button of the scene and the dialog it opens (docs/design.md,
 * Export): choice of format (SVG, PNG, PDF), PNG resolution (1024, 2048 or
 * 4096 px), and for the PDF the real size in centimetres and the stroke in
 * millimetres of the tattoo stencil; a thumbnail of the file to come; a
 * "Download" button with a loading state while the file is written.
 *
 * Exposes `ExportDialog`, its props and `ExportStrings`. Holds the format and
 * resolution only; the stencil stroke and size are owned by the parent (the
 * "Style" section shares the stroke). While a file is being written the
 * download button stays focusable (`aria-disabled`, never `disabled`) and
 * ignores further clicks. A size outside 1–25 cm, or too large for the page,
 * is explained under the field and blocks the PDF download. Holds no wording
 * of its own and never receives the intention, so it cannot end up in a file
 * or its name.
 */
import { useMemo, useState } from 'react';

import {
  Button,
  Dialog,
  SegmentedControl,
  Slider,
  StatusMessage,
  TextField,
} from '../../components/ui/index.ts';
import type { SegmentedOption } from '../../components/ui/index.ts';
import {
  snapStencilStrokeMm,
  stencilScale,
  STENCIL_STROKE_MM_MAX,
  STENCIL_STROKE_MM_MIN,
  STENCIL_STROKE_MM_STEP,
} from '../sigil/index.ts';
import type { Sigil, StyleOptions } from '../sigil/types.ts';
import './ExportDialog.css';
import { exportSigilPdf, exportSigilPng, exportSigilSvg } from './exportSigil.ts';
import type { SigilExport } from './exportSigil.ts';
import type { ExportFormat, SigilMethod } from './fileName.ts';
import { readExportPalette } from './palette.ts';
import { layoutStencilPage } from './pdf.ts';
import type { StencilPage, StencilPdfTexts } from './pdf.ts';
import { EXPORT_PNG_SIZE } from './png.ts';
import { MM_PER_CM, parsePrintSize } from './printSize.ts';
import type { PrintSizeError, PrintSizeResult } from './printSize.ts';
import { buildSigilSvg } from './svg.ts';

/** PNG sides offered, in pixels: screen, print (the default) and large print. */
export const EXPORT_PNG_SIZES = [1024, EXPORT_PNG_SIZE, 4096] as const;

/** One of the PNG sides offered. */
export type ExportPngSize = (typeof EXPORT_PNG_SIZES)[number];

/** Pixel size of the SVG thumbnail written for the preview: small, it is shown at most 160 px wide. */
const PREVIEW_SIZE = 320;

/** Id of the print size field, from which its help and error ids derive. */
const SIZE_FIELD_ID = 'export-size';

/** Id of the stencil stroke slider of the dialog. */
const STROKE_FIELD_ID = 'export-stroke-mm';

/** Texts of the export button and dialog, in the interface language. */
export interface ExportStrings {
  /** Label of the button that opens the dialog, and the dialog's title ("Exporter"). */
  readonly open: string;
  /** Title of the dialog. */
  readonly title: string;
  /** Legend of the format choice. */
  readonly formatLegend: string;
  /** Label of each format. */
  readonly formats: Readonly<Record<ExportFormat, string>>;
  /** One line under the format choice saying what the file is for. */
  readonly formatHelp: Readonly<Record<ExportFormat, string>>;
  /** Legend of the PNG resolution choice. */
  readonly resolutionLegend: string;
  /** Label of a PNG side ("2048 px"). */
  readonly resolution: (pixels: number) => string;
  /** Label of the print size field. */
  readonly sizeLabel: string;
  /** Help under the print size field (the range). */
  readonly sizeHelp: string;
  /** Error under the print size field, by reason. */
  readonly sizeError: (error: PrintSizeError) => string;
  /** Error when the size is valid but too large for an A4 page, given the largest size that fits. */
  readonly sizeTooLarge: (maxCentimetres: number) => string;
  /** Label of the stencil stroke slider. */
  readonly strokeLabel: string;
  /** Stroke value next to the slider ("0,6 mm"). */
  readonly strokeValue: (millimetres: number) => string;
  /** Help under the stroke slider. */
  readonly strokeHelp: string;
  /** Accessible name of the preview, by format. */
  readonly preview: (format: string) => string;
  /** Label of the button that closes the dialog without exporting. */
  readonly cancel: string;
  /** Label of the download button. */
  readonly download: string;
  /** Message shown when an export fails, given the format's label. */
  readonly error: (format: string) => string;
  /** Texts printed on the PDF, given its size and stroke. */
  readonly pdf: (centimetres: number, millimetres: number) => StencilPdfTexts;
}

/** Props of `ExportDialog`. */
export interface ExportDialogProps {
  /** Sigil shown on the scene; `undefined` disables the button. */
  readonly sigil: Sigil | undefined;
  /** Method of that sigil, written in the file name. */
  readonly method: SigilMethod | undefined;
  /** Style settings as shown (stroke width already converted in stencil mode), for SVG and PNG. */
  readonly styleOptions: StyleOptions;
  /** Stencil stroke on paper, in millimetres, shared with the "Style" section. */
  readonly strokeMm: number;
  /** Called with a new stencil stroke, snapped to the setting's grid. */
  readonly onStrokeMmChange: (millimetres: number) => void;
  /** Print size as typed, in centimetres. */
  readonly sizeText: string;
  /** Called with the new text of the print size field. */
  readonly onSizeTextChange: (text: string) => void;
  /** Interface texts. */
  readonly strings: ExportStrings;
}

/**
 * Renders the "Export" button and, once it is pressed, the dialog.
 *
 * @returns The button, followed by the dialog element.
 */
export function ExportDialog({
  sigil,
  method,
  styleOptions,
  strokeMm,
  onStrokeMmChange,
  sizeText,
  onSizeTextChange,
  strings,
}: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('svg');
  const [pngSize, setPngSize] = useState<ExportPngSize>(EXPORT_PNG_SIZE);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<ExportFormat | null>(null);
  const target: SigilExport | undefined =
    sigil === undefined || method === undefined ? undefined : { sigil, styleOptions, method };

  const { roundEnds } = styleOptions;
  // One memo on plain inputs: the layout runs the stencil scale search, not worth repeating per render.
  const print = useMemo(
    () => stencilPrint(sigil, roundEnds, strokeMm, sizeText, strings),
    [sigil, roundEnds, strokeMm, sizeText, strings],
  );
  const { size, page, pdfTexts } = print;
  const sizeCm = size.ok ? size.centimetres : undefined;
  const sizeError = !size.ok
    ? strings.sizeError(size.error)
    : page !== undefined && !page.fits
      ? strings.sizeTooLarge(page.maxSizeCm)
      : undefined;
  const blocked = target === undefined || (format === 'pdf' && page?.fits !== true);
  const preview = useMemo(
    () =>
      open && sigil !== undefined
        ? previewUrl(sigil, styleOptions, format, strokeMm, sizeCm)
        : undefined,
    [open, sigil, styleOptions, format, strokeMm, sizeCm],
  );

  const formatOptions: SegmentedOption<ExportFormat>[] = (['svg', 'png', 'pdf'] as const).map(
    (value) => ({ value, label: strings.formats[value] }),
  );
  const sizeOptions: SegmentedOption<string>[] = EXPORT_PNG_SIZES.map((pixels) => ({
    value: String(pixels),
    label: strings.resolution(pixels),
  }));

  /** Writes and downloads the chosen file, then closes the dialog; shows an error on failure. */
  async function handleDownload() {
    if (target === undefined || busy || blocked) return;
    setBusy(true);
    try {
      if (format === 'svg') exportSigilSvg(target);
      else if (format === 'png') await exportSigilPng(target, pngSize);
      else if (sizeCm !== undefined && pdfTexts !== undefined) {
        await exportSigilPdf(target, { strokeMm, sizeCm }, pdfTexts);
      }
      setFailed(null);
      setOpen(false);
    } catch (error) {
      // Logged for diagnosis: the error carries no user data, only what failed.
      console.error(`Sigil ${format.toUpperCase()} export failed.`, error);
      setFailed(format);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        disabled={target === undefined}
        onClick={() => {
          setFailed(null);
          setOpen(true);
        }}
      >
        {strings.open}
      </Button>
      <Dialog
        open={open && target !== undefined}
        title={strings.title}
        onClose={() => {
          setOpen(false);
        }}
      >
        <div className="export-dialog">
          <div className="export-dialog__settings">
            <SegmentedControl
              legend={strings.formatLegend}
              name="export-format"
              options={formatOptions}
              value={format}
              onChange={setFormat}
            />
            <p className="export-dialog__help">{strings.formatHelp[format]}</p>
            {format === 'png' && (
              <SegmentedControl
                legend={strings.resolutionLegend}
                name="export-resolution"
                options={sizeOptions}
                value={String(pngSize)}
                onChange={(value) => {
                  setPngSize(
                    EXPORT_PNG_SIZES.find((pixels) => String(pixels) === value) ?? EXPORT_PNG_SIZE,
                  );
                }}
              />
            )}
            {format === 'pdf' && (
              <>
                <TextField
                  id={SIZE_FIELD_ID}
                  label={strings.sizeLabel}
                  value={sizeText}
                  onValueChange={onSizeTextChange}
                  help={strings.sizeHelp}
                  error={sizeError}
                  inputMode="decimal"
                  autoComplete="off"
                />
                <Slider
                  id={STROKE_FIELD_ID}
                  label={strings.strokeLabel}
                  value={strokeMm}
                  min={STENCIL_STROKE_MM_MIN}
                  max={STENCIL_STROKE_MM_MAX}
                  step={STENCIL_STROKE_MM_STEP}
                  valueText={strings.strokeValue(strokeMm)}
                  help={strings.strokeHelp}
                  onValueChange={(value) => {
                    onStrokeMmChange(snapStencilStrokeMm(value));
                  }}
                />
              </>
            )}
          </div>
          {preview !== undefined && (
            <figure className="export-dialog__preview">
              <img src={preview} alt={strings.preview(strings.formats[format])} />
            </figure>
          )}
        </div>
        {failed !== null && (
          <StatusMessage tone="error">{strings.error(strings.formats[failed])}</StatusMessage>
        )}
        <div className="export-dialog__actions">
          <Button
            variant="secondary"
            onClick={() => {
              setOpen(false);
            }}
          >
            {strings.cancel}
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={blocked}
            onClick={() => void handleDownload()}
          >
            {strings.download}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

/** The PDF settings read from the dialog, and the page they give. */
interface StencilPrintState {
  /** Print size typed, read. */
  readonly size: PrintSizeResult;
  /** Texts printed on the PDF, once the size is valid. */
  readonly pdfTexts: StencilPdfTexts | undefined;
  /** Page layout, once there is a sigil and a valid size. */
  readonly page: StencilPage | undefined;
}

/**
 * Reads the print size and lays out the stencil page it gives.
 *
 * @param sigil - Sigil shown, if any.
 * @param roundEnds - Line ends setting.
 * @param strokeMm - Stencil stroke, in millimetres.
 * @param sizeText - Print size as typed.
 * @param strings - Interface texts, for the PDF texts.
 * @returns The size read, and the texts and page when they can be built.
 */
function stencilPrint(
  sigil: Sigil | undefined,
  roundEnds: boolean,
  strokeMm: number,
  sizeText: string,
  strings: ExportStrings,
): StencilPrintState {
  const size = parsePrintSize(sizeText);
  if (!size.ok) return { size, pdfTexts: undefined, page: undefined };
  const pdfTexts = strings.pdf(size.centimetres, strokeMm);
  const page =
    sigil === undefined
      ? undefined
      : layoutStencilPage(sigil, roundEnds, strokeMm, size.centimetres, pdfTexts);
  return { size, pdfTexts, page };
}

/**
 * Thumbnail of the file to come, as an SVG data URL (the page's CSP allows
 * `data:` images): the theme colours for SVG and PNG, the stencil for the PDF.
 *
 * @param sigil - Sigil shown.
 * @param styleOptions - Style settings shown.
 * @param format - Format chosen.
 * @param strokeMm - Stencil stroke, for the PDF.
 * @param sizeCm - Print size when valid, for the PDF stroke; otherwise the
 *   stroke shown on screen is kept.
 * @returns The data URL, or `undefined` when the colours cannot be read (the
 *   failure is logged; the export itself will report it).
 */
function previewUrl(
  sigil: Sigil,
  styleOptions: StyleOptions,
  format: ExportFormat,
  strokeMm: number,
  sizeCm: number | undefined,
): string | undefined {
  const style: StyleOptions =
    format !== 'pdf'
      ? styleOptions
      : {
          ...styleOptions,
          mode: 'stencil',
          strokeWidth:
            sizeCm === undefined
              ? styleOptions.strokeWidth
              : stencilScale(sigil, styleOptions.roundEnds, strokeMm, sizeCm * MM_PER_CM)
                  .strokeWidth,
        };
  try {
    const svg = buildSigilSvg(sigil, style, readExportPalette(style.mode), PREVIEW_SIZE);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch (error) {
    console.error('Sigil export preview could not be drawn.', error);
    return undefined;
  }
}
