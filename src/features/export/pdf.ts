/**
 * Real-size tattoo stencil PDF: one A4 portrait page with the sigil in pure
 * black vector lines, the largest dimension of its ink at the size asked for,
 * its stroke at the millimetres asked for, and a 1 cm control ruler with the
 * printing instruction under it.
 *
 * Exposes the unit conversions (`PT_PER_MM`, `cmToPoints`, `mmToPoints`), the
 * page geometry (`A4_MM`, `STENCIL_AREA_MM`), `layoutStencilPage` (pure: where
 * every line goes, in PDF points, and whether the sigil fits the page) and
 * `buildStencilPdf` (writes the file with pdf-lib, loaded on demand so the
 * library only weighs on the first PDF export). The file's metadata are
 * neutral: title, creator and producer "Sigil", the export date, and nothing
 * else; the intention is never passed here. The notes use the standard
 * Helvetica font with a WinAnsi to Unicode table (`winAnsiToUnicodeCMap`), so
 * their accents and apostrophes come out right when the text is copied or
 * searched. Line ends and the miter limit come from `lineEndsFor`, as in the SVG.
 */
import type { PDFDocument, PDFFont, PDFOperator } from 'pdf-lib';
import type * as PdfLib from 'pdf-lib';

import { endBarEndpoints, lineEndsFor, stencilScale } from '../sigil/index.ts';
import type { Mark, Point, Sigil } from '../sigil/types.ts';
import { MM_PER_CM, PRINT_SIZE_MAX_CM, PRINT_SIZE_MIN_CM } from './printSize.ts';
import { EXPORT_SVG_TITLE } from './svg.ts';

/** PDF points per millimetre: a point is 1/72 inch and an inch is 25.4 mm. */
export const PT_PER_MM = 72 / 25.4;

/** ISO 216 A4 sheet, portrait, in millimetres. */
export const A4_MM = { width: 210, height: 297 } as const;

/**
 * Blank border kept on every side, in millimetres: wider than the unprintable
 * margin of office printers (about 5 mm), so nothing is clipped at 100 %.
 */
const PAGE_MARGIN_MM = 10;

/** Band kept at the bottom of the page for the ruler and the notes, in millimetres. */
const NOTES_BAND_MM = 35;

/**
 * Rectangle the sigil's ink must fit in, in millimetres from the top-left
 * corner of the page: the page minus its margins and the notes band. Its
 * height (252 mm) holds the 25 cm maximum of a tall sigil; its width (190 mm)
 * limits a wide one.
 */
export const STENCIL_AREA_MM = {
  x: PAGE_MARGIN_MM,
  y: PAGE_MARGIN_MM,
  width: A4_MM.width - 2 * PAGE_MARGIN_MM,
  height: A4_MM.height - PAGE_MARGIN_MM - NOTES_BAND_MM,
} as const;

/** Length of the control ruler: 1 cm, the unit printed next to it. */
const RULER_LENGTH_MM = 10;

/** Height of the ruler's end ticks, in millimetres, centred on its line. */
const RULER_TICK_MM = 3;

/** Line width of the ruler, in millimetres: thin, so its ticks are read precisely. */
const RULER_LINE_MM = 0.2;

/** Left end of the ruler, in millimetres from the page's left edge. */
const RULER_X_MM = 20;

/** Ruler line, in millimetres from the top of the page: in the notes band. */
const RULER_Y_MM = 272;

/** Gap between the ruler's right end and its "1 cm" label, in millimetres. */
const RULER_LABEL_GAP_MM = 3;

/** Baselines of the two note lines under the ruler, in millimetres from the top. */
const NOTE_BASELINES_MM = [280, 285] as const;

/** Text size of the label and the notes, in points: legible once printed. */
const NOTE_FONT_SIZE_PT = 9;

/**
 * WinAnsi codes the notes can use, space (0x20) to ÿ (0xFF): the standard
 * Helvetica font draws one byte per character in that encoding.
 */
const WIN_ANSI_FIRST_CODE = 0x20;
const WIN_ANSI_LAST_CODE = 0xff;

/**
 * Unicode control characters a WinAnsi code may decode to (DEL and the C1
 * range): they mark the codes WinAnsi leaves undefined.
 */
const CONTROL_CHARACTERS = { first: 0x7f, last: 0x9f } as const;

/** Entries per `beginbfchar` block: the CMap format allows at most 100. */
const CMAP_BLOCK_SIZE = 100;

/**
 * Distance of the Bézier control points from the ends of a quarter circle,
 * as a fraction of the radius: the classic 4·(√2 − 1)/3, within 0.03 % of the
 * true circle and never outside its bounding box.
 */
const QUARTER_CIRCLE_KAPPA = (4 * (Math.SQRT2 - 1)) / 3;

/**
 * Allowance on the fit test, in millimetres: float noise must not refuse a
 * sigil whose ink touches the area's edge exactly.
 */
const FIT_EPSILON_MM = 1e-6;

/** Bisection rounds when looking for the largest size that fits: below 0.001 mm. */
const FIT_BISECTION_ROUNDS = 40;

/**
 * Converts millimetres to PDF points.
 *
 * @param millimetres - Length on paper.
 * @returns The length in points (1 mm = 72 / 25.4 pt).
 */
export function mmToPoints(millimetres: number): number {
  return millimetres * PT_PER_MM;
}

/**
 * Converts centimetres to PDF points.
 *
 * @param centimetres - Length on paper.
 * @returns The length in points (1 cm = 72 / 2.54 pt ≈ 28.35 pt).
 */
export function cmToPoints(centimetres: number): number {
  return mmToPoints(centimetres * MM_PER_CM);
}

/** Width and height of ink on paper, in millimetres. */
interface InkSize {
  readonly width: number;
  readonly height: number;
}

/** One drawing command of a path, in PDF points (origin bottom-left, y upwards). */
export type PdfPathCommand =
  | { readonly op: 'move' | 'line'; readonly to: Point }
  | { readonly op: 'curve'; readonly control1: Point; readonly control2: Point; readonly to: Point }
  | { readonly op: 'close' };

/** A piece of text on the page. */
export interface PdfText {
  readonly text: string;
  /** Start of the baseline, in points. */
  readonly at: Point;
}

/** Everything drawn on the stencil page, in PDF points. */
export interface StencilPage {
  /** Page width and height in points (A4 portrait). */
  readonly width: number;
  readonly height: number;
  /** Stroke width of the sigil in points: the millimetres asked for. */
  readonly lineWidth: number;
  /** Line ends setting: round caps and joins, or flat caps and mitred joins. */
  readonly roundEnds: boolean;
  /** Sigil paths (strokes then marks), each stroked once. */
  readonly paths: readonly (readonly PdfPathCommand[])[];
  /** Width and height of the sigil's ink on paper, in millimetres. */
  readonly inkMm: InkSize;
  /** Whether the ink fits within `STENCIL_AREA_MM` at this size. */
  readonly fits: boolean;
  /**
   * Largest size, in centimetres rounded down to a tenth, at which this sigil
   * fits the page with this stroke; `PRINT_SIZE_MAX_CM` when every offered size fits.
   */
  readonly maxSizeCm: number;
  /** Control ruler: its line and two end ticks, stroked at `ruler.lineWidth`. */
  readonly ruler: {
    readonly paths: readonly (readonly PdfPathCommand[])[];
    readonly lineWidth: number;
  };
  /** Ruler label and the two note lines, in that order. */
  readonly texts: readonly PdfText[];
  /** Text size of `texts`, in points. */
  readonly fontSize: number;
}

/** Texts printed on the stencil page, in the interface language. */
export interface StencilPdfTexts {
  /** Label of the control ruler, "1 cm". */
  readonly ruler: string;
  /** Printing instruction, "print at 100 %, without scaling". */
  readonly instruction: string;
  /** Size and stroke of the print, for instance "Sigil: 6 cm, 0.6 mm stroke". */
  readonly details: string;
}

/**
 * Lays out the stencil page: the sigil scaled so the largest dimension of its
 * ink is `sizeCm`, centred in `STENCIL_AREA_MM`, stroked at `strokeMm`; the
 * ruler and the texts in the notes band.
 *
 * @param sigil - Sigil to print.
 * @param roundEnds - `StyleOptions.roundEnds`.
 * @param strokeMm - Stroke on paper, in millimetres, positive.
 * @param sizeCm - Largest dimension of the ink, in centimetres, positive.
 * @param texts - Ruler label and notes.
 * @returns The page in points; `fits` tells whether it can be printed as is.
 * @throws {RangeError} When the stroke or size is not positive, or the sigil has no ink.
 */
export function layoutStencilPage(
  sigil: Sigil,
  roundEnds: boolean,
  strokeMm: number,
  sizeCm: number,
  texts: StencilPdfTexts,
): StencilPage {
  const scale = stencilScale(sigil, roundEnds, strokeMm, sizeCm * MM_PER_CM);
  const k = scale.millimetresPerUnit;
  const inkMm = { width: scale.ink.width * k, height: scale.ink.height * k };
  const inkCentre = {
    x: scale.ink.x + scale.ink.width / 2,
    y: scale.ink.y + scale.ink.height / 2,
  };
  const areaCentre = {
    x: STENCIL_AREA_MM.x + STENCIL_AREA_MM.width / 2,
    y: STENCIL_AREA_MM.y + STENCIL_AREA_MM.height / 2,
  };
  /**
   * Places a frame point on the page.
   *
   * @param point - Point in frame units (y downwards).
   * @returns The point in PDF points (y upwards).
   */
  const place = (point: Point): Point =>
    pagePoint({
      x: areaCentre.x + (point.x - inkCentre.x) * k,
      y: areaCentre.y + (point.y - inkCentre.y) * k,
    });

  const paths = [
    ...scale.drawing.strokes.map((stroke) => polylinePath(stroke.map(place))),
    ...scale.drawing.marks.map((mark) => markPath(mark, place, k)),
  ];
  const fits = inkFits(inkMm);

  return {
    width: mmToPoints(A4_MM.width),
    height: mmToPoints(A4_MM.height),
    lineWidth: mmToPoints(strokeMm),
    roundEnds,
    paths,
    inkMm,
    fits,
    maxSizeCm: fits ? PRINT_SIZE_MAX_CM : largestFittingSize(sigil, roundEnds, strokeMm, sizeCm),
    ruler: { paths: rulerPaths(), lineWidth: mmToPoints(RULER_LINE_MM) },
    texts: [
      {
        text: texts.ruler,
        at: pagePoint({ x: RULER_X_MM + RULER_LENGTH_MM + RULER_LABEL_GAP_MM, y: RULER_Y_MM + 1 }),
      },
      { text: texts.instruction, at: pagePoint({ x: RULER_X_MM, y: NOTE_BASELINES_MM[0] }) },
      { text: texts.details, at: pagePoint({ x: RULER_X_MM, y: NOTE_BASELINES_MM[1] }) },
    ],
    fontSize: NOTE_FONT_SIZE_PT,
  };
}

/**
 * Writes the stencil page as a PDF file.
 *
 * @param page - Layout from `layoutStencilPage`; must fit the page.
 * @param now - Moment of the export, written as creation and modification dates.
 * @returns The PDF file content.
 * @throws {RangeError} When the sigil does not fit the page.
 * @throws {Error} When pdf-lib cannot be loaded or a text has a character
 *   the standard Helvetica font cannot encode.
 * @remarks Loads the pdf-lib chunk on first use (precached by the service
 *   worker, so it also works offline).
 */
export async function buildStencilPdf(page: StencilPage, now: Date): Promise<Uint8Array> {
  if (!page.fits) {
    throw new RangeError(
      `Cannot export PDF: the sigil is ${page.inkMm.width.toFixed(1)} × ${page.inkMm.height.toFixed(1)} mm, larger than the printable area.`,
    );
  }
  const lib = await import('pdf-lib');
  // Without updateMetadata: false, pdf-lib writes its own name as producer and creator.
  const document = await lib.PDFDocument.create({ updateMetadata: false });
  document.setTitle(EXPORT_SVG_TITLE);
  document.setCreator(EXPORT_SVG_TITLE);
  document.setProducer(EXPORT_SVG_TITLE);
  document.setCreationDate(now);
  document.setModificationDate(now);
  const pdfPage = document.addPage([page.width, page.height]);
  const font = await document.embedFont(lib.StandardFonts.Helvetica);

  /**
   * Turns path commands into PDF operators.
   *
   * @param paths - Paths in points.
   * @returns Each path's construction followed by a stroke.
   */
  const pathOperators = (paths: StencilPage['paths']): PDFOperator[] =>
    paths.flatMap((path) => [
      ...path.map((command) => {
        switch (command.op) {
          case 'move':
            return lib.moveTo(command.to.x, command.to.y);
          case 'line':
            return lib.lineTo(command.to.x, command.to.y);
          case 'curve':
            return lib.appendBezierCurve(
              command.control1.x,
              command.control1.y,
              command.control2.x,
              command.control2.y,
              command.to.x,
              command.to.y,
            );
          case 'close':
            return lib.closePath();
        }
      }),
      lib.stroke(),
    ]);

  // Sigil first, in its own graphics state: pure black, the stroke in
  // millimetres, the line ends and miter limit of the SVG.
  const lineEnds = lineEndsFor(page.roundEnds);
  pdfPage.pushOperators(
    lib.pushGraphicsState(),
    lib.setStrokingRgbColor(0, 0, 0),
    lib.setLineWidth(page.lineWidth),
    lib.setLineCap(
      lineEnds.strokeLinecap === 'round' ? lib.LineCapStyle.Round : lib.LineCapStyle.Butt,
    ),
    lib.setLineJoin(
      lineEnds.strokeLinejoin === 'round' ? lib.LineJoinStyle.Round : lib.LineJoinStyle.Miter,
    ),
    ...(lineEnds.strokeMiterlimit === undefined
      ? []
      : [
          lib.PDFOperator.of(lib.PDFOperatorNames.SetLineMiterLimit, [
            lib.PDFNumber.of(lineEnds.strokeMiterlimit),
          ]),
        ]),
    ...pathOperators(page.paths),
    lib.popGraphicsState(),
  );
  // Then the ruler, with flat caps so its ticks sit exactly 1 cm apart.
  pdfPage.pushOperators(
    lib.pushGraphicsState(),
    lib.setStrokingRgbColor(0, 0, 0),
    lib.setLineWidth(page.ruler.lineWidth),
    lib.setLineCap(lib.LineCapStyle.Butt),
    ...pathOperators(page.ruler.paths),
    lib.popGraphicsState(),
  );
  for (const { text, at } of page.texts) {
    pdfPage.drawText(text, {
      x: at.x,
      y: at.y,
      size: page.fontSize,
      font,
      color: lib.rgb(0, 0, 0),
    });
  }
  await attachToUnicode(lib, document, font);
  return document.save();
}

/**
 * Gives the embedded standard font a ToUnicode table, which pdf-lib does not
 * write: without it, several readers turn the accented letters and the
 * typographic apostrophe of the notes into garbage when the text is copied
 * or searched.
 *
 * @param lib - The pdf-lib module, loaded on demand.
 * @param document - Document being written.
 * @param font - Standard Helvetica font, after every text was drawn with it.
 * @remarks Embeds the font dictionary now (pdf-lib would otherwise write it
 *   at save time, over this addition) and adds a compressed CMap stream to it.
 */
async function attachToUnicode(
  lib: typeof PdfLib,
  document: PDFDocument,
  font: PDFFont,
): Promise<void> {
  // Embedding clears the font's "modified" flag, so `save()` keeps this dictionary.
  await font.embed();
  const fontDict = document.context.lookup(font.ref, lib.PDFDict);
  const cmap = document.context.flateStream(winAnsiToUnicodeCMap());
  fontDict.set(lib.PDFName.of('ToUnicode'), document.context.register(cmap));
}

/**
 * ToUnicode CMap of the WinAnsi encoding: each one-byte code the standard
 * fonts draw, mapped to its Unicode character.
 *
 * @returns The CMap program, as text (ASCII only).
 * @remarks Codes WinAnsi leaves undefined (0x7F, 0x81, 0x8D, 0x8F, 0x90,
 *   0x9D) decode to control characters and get no entry.
 */
export function winAnsiToUnicodeCMap(): string {
  const decoder = new TextDecoder('windows-1252');
  const entries: string[] = [];
  for (let code = WIN_ANSI_FIRST_CODE; code <= WIN_ANSI_LAST_CODE; code += 1) {
    const unicode = decoder.decode(Uint8Array.of(code)).codePointAt(0) ?? 0;
    const isControl =
      unicode < WIN_ANSI_FIRST_CODE ||
      (unicode >= CONTROL_CHARACTERS.first && unicode <= CONTROL_CHARACTERS.last);
    if (isControl) continue;
    entries.push(`<${hexCode(code, 2)}> <${hexCode(unicode, 4)}>`);
  }
  const charBlocks: string[] = [];
  for (let start = 0; start < entries.length; start += CMAP_BLOCK_SIZE) {
    const block = entries.slice(start, start + CMAP_BLOCK_SIZE);
    charBlocks.push(`${String(block.length)} beginbfchar`, ...block, 'endbfchar');
  }
  return [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<00> <FF>',
    'endcodespacerange',
    ...charBlocks,
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n');
}

/**
 * Upper-case hexadecimal of a code, padded with zeros.
 *
 * @param value - Non-negative integer.
 * @param digits - Minimum number of digits.
 * @returns For instance `"E9"` or `"2019"`.
 */
function hexCode(value: number, digits: number): string {
  return value.toString(16).toUpperCase().padStart(digits, '0');
}

/**
 * Converts a position given in millimetres from the top-left corner of the
 * page into PDF points from the bottom-left corner.
 *
 * @param point - Position in millimetres, y downwards.
 * @returns The position in points, y upwards.
 */
function pagePoint(point: Point): Point {
  return { x: mmToPoints(point.x), y: mmToPoints(A4_MM.height - point.y) };
}

/**
 * Whether ink of a given size fits the sigil's area.
 *
 * @param inkMm - Width and height of the ink on paper, in millimetres.
 * @returns True when both stay within `STENCIL_AREA_MM`.
 */
function inkFits(inkMm: InkSize): boolean {
  return (
    inkMm.width <= STENCIL_AREA_MM.width + FIT_EPSILON_MM &&
    inkMm.height <= STENCIL_AREA_MM.height + FIT_EPSILON_MM
  );
}

/**
 * Largest print size, in tenths of a centimetre, at which the sigil fits the
 * area; the stroke's share of the ink changes with the size, hence a search
 * rather than a rule of three.
 *
 * @param sigil - Sigil to print.
 * @param roundEnds - Line ends setting.
 * @param strokeMm - Stroke on paper, in millimetres.
 * @param tooLargeCm - A size known not to fit, in centimetres.
 * @returns The largest fitting size rounded down to 0.1 cm, at least `PRINT_SIZE_MIN_CM`.
 */
function largestFittingSize(
  sigil: Sigil,
  roundEnds: boolean,
  strokeMm: number,
  tooLargeCm: number,
): number {
  /**
   * Tells whether the sigil fits at a size.
   *
   * @param sizeCm - Print size in centimetres.
   * @returns True when its ink fits the area.
   */
  const fitsAt = (sizeCm: number): boolean => {
    const scale = stencilScale(sigil, roundEnds, strokeMm, sizeCm * MM_PER_CM);
    const k = scale.millimetresPerUnit;
    return inkFits({ width: scale.ink.width * k, height: scale.ink.height * k });
  };
  let low = PRINT_SIZE_MIN_CM;
  let high = tooLargeCm;
  for (let round = 0; round < FIT_BISECTION_ROUNDS; round += 1) {
    const middle = (low + high) / 2;
    if (fitsAt(middle)) low = middle;
    else high = middle;
  }
  return Math.max(PRINT_SIZE_MIN_CM, Math.floor(low * 10) / 10);
}

/**
 * Path of a polyline.
 *
 * @param points - Points in PDF points, at least one.
 * @returns A move to the first point and a line to each next one.
 */
function polylinePath(points: readonly Point[]): PdfPathCommand[] {
  return points.map((to, index) => ({ op: index === 0 ? 'move' : 'line', to }));
}

/**
 * Path of a mark: a line for the end bar, a closed circle of four Bézier
 * quarters for the start circle and the loops.
 *
 * @param mark - Mark as drawn (resized), in frame units.
 * @param place - Converts a frame point to page points.
 * @param millimetresPerUnit - Scale of the print, for the circle radius.
 * @returns The path in PDF points.
 */
function markPath(
  mark: Mark,
  place: (point: Point) => Point,
  millimetresPerUnit: number,
): PdfPathCommand[] {
  if (mark.kind === 'end-bar') {
    const [from, to] = endBarEndpoints(mark, mark.length);
    return polylinePath([place(from), place(to)]);
  }
  return circlePath(place(mark.center), mmToPoints(mark.radius * millimetresPerUnit));
}

/**
 * Closed circle drawn as four cubic Bézier quarters, starting on the right.
 *
 * @param centre - Centre in points.
 * @param radius - Radius in points.
 * @returns The path in PDF points.
 */
function circlePath(centre: Point, radius: number): PdfPathCommand[] {
  const handle = radius * QUARTER_CIRCLE_KAPPA;
  const { x, y } = centre;
  /**
   * One quarter, from the current point to `to`.
   *
   * @param control1 - First control point.
   * @param control2 - Second control point.
   * @param to - End of the quarter.
   * @returns The curve command.
   */
  const quarter = (control1: Point, control2: Point, to: Point): PdfPathCommand => ({
    op: 'curve',
    control1,
    control2,
    to,
  });
  return [
    { op: 'move', to: { x: x + radius, y } },
    quarter(
      { x: x + radius, y: y + handle },
      { x: x + handle, y: y + radius },
      { x, y: y + radius },
    ),
    quarter(
      { x: x - handle, y: y + radius },
      { x: x - radius, y: y + handle },
      { x: x - radius, y },
    ),
    quarter(
      { x: x - radius, y: y - handle },
      { x: x - handle, y: y - radius },
      { x, y: y - radius },
    ),
    quarter(
      { x: x + handle, y: y - radius },
      { x: x + radius, y: y - handle },
      { x: x + radius, y },
    ),
    { op: 'close' },
  ];
}

/**
 * Control ruler: a 1 cm line with a tick at each end.
 *
 * @returns Three paths in PDF points.
 */
function rulerPaths(): PdfPathCommand[][] {
  const left = RULER_X_MM;
  const right = RULER_X_MM + RULER_LENGTH_MM;
  const top = RULER_Y_MM - RULER_TICK_MM / 2;
  const bottom = RULER_Y_MM + RULER_TICK_MM / 2;
  return [
    polylinePath([pagePoint({ x: left, y: RULER_Y_MM }), pagePoint({ x: right, y: RULER_Y_MM })]),
    polylinePath([pagePoint({ x: left, y: top }), pagePoint({ x: left, y: bottom })]),
    polylinePath([pagePoint({ x: right, y: top }), pagePoint({ x: right, y: bottom })]),
  ];
}
