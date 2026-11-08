/**
 * Tests of the real-size stencil PDF (F5): unit conversions, the page layout
 * (centred, fits or refused with the largest size that fits), and the file
 * itself read back with pdf-lib: A4 portrait, the sigil's ink measuring the
 * size asked for within 0.5 mm, the stroke in points, pure black, the 1 cm
 * ruler, the miter limit of the SVG with flat ends, neutral metadata without
 * any tool name or intention, and texts that read back with their accents
 * through the font's ToUnicode table.
 */
import { decodePDFRawStream, PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { buildKameaSigil } from '../kamea/index.ts';
import { lineEndsFor } from '../sigil/index.ts';
import type { Sigil } from '../sigil/types.ts';
import { buildSpareSigil } from '../spare/index.ts';
import {
  A4_MM,
  buildStencilPdf,
  cmToPoints,
  layoutStencilPage,
  mmToPoints,
  PT_PER_MM,
  STENCIL_AREA_MM,
  winAnsiToUnicodeCMap,
} from './pdf.ts';
import type { StencilPdfTexts } from './pdf.ts';

/** "Je suis calme" after normalisation. */
const JE_SUIS_CALME = ['J', 'E', 'S', 'U', 'I', 'S', 'C', 'A', 'L', 'M', 'E'];

/** "ABCD" on Saturn: a sigil as wide as it is tall, which a portrait A4 holds up to 19 cm. */
const ABCD = ['A', 'B', 'C', 'D'];

/** Texts as the French dictionary writes them for 6 cm and 0.6 mm. */
const TEXTS_FR: StencilPdfTexts = {
  ruler: '1 cm',
  instruction: 'Imprimer à 100 %, sans mise à l’échelle ni ajustement à la page.',
  details: 'Sigil : 6 cm dans sa plus grande dimension, trait de 0,6 mm.',
};

/** Texts as the English dictionary writes them. */
const TEXTS_EN: StencilPdfTexts = {
  ruler: '1 cm',
  instruction: 'Print at 100%, without scaling or fit to page.',
  details: 'Sigil: 6 cm along its largest dimension, 0.6 mm stroke.',
};

/** Tolerance of the F5 scenario on the printed size, in millimetres. */
const SIZE_TOLERANCE_MM = 0.5;

/** A fixed export moment. */
const NOW = new Date(2026, 10, 8, 15, 30, 12);

/**
 * Builds a kamea sigil and fails the test if the builder refused.
 *
 * @param letters - Normalised letters.
 * @param planet - Square to draw on.
 * @returns The sigil.
 */
function kamea(letters: readonly string[], planet: 'saturn' | 'moon' = 'saturn'): Sigil {
  const result = buildKameaSigil(letters, planet);
  if (!result.ok) throw new Error(`Unexpected kamea error ${result.error.code}`);
  return result.data;
}

/**
 * Builds the first Spare variant and fails the test if the builder refused.
 *
 * @param letters - Normalised letters.
 * @returns The sigil.
 */
function spare(letters: readonly string[]): Sigil {
  const result = buildSpareSigil(letters, { keepVowels: false, variant: 0 });
  if (!result.ok) throw new Error(`Unexpected Spare error ${result.error.code}`);
  return result.data;
}

/** What the content stream of the page says, once parsed. */
interface ReadBack {
  /** Each `q … Q` block's operators, in order. */
  readonly blocks: readonly { readonly op: string; readonly args: readonly number[] }[][];
  /** The whole decoded content, as text. */
  readonly text: string;
}

/**
 * Decodes and parses the content of the first page of a PDF.
 *
 * @param document - Loaded PDF.
 * @returns The top-level graphics state blocks with their numeric operators.
 */
function readContent(document: PDFDocument): ReadBack {
  const contents = document.getPage(0).node.Contents();
  if (contents === undefined) throw new Error('Page without content.');
  const refs = 'asArray' in contents ? contents.asArray() : [contents];
  let text = '';
  for (const ref of refs) {
    const stream = document.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) throw new Error('Unexpected content stream type.');
    text += new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode());
    text += '\n';
  }
  const blocks: { op: string; args: number[] }[][] = [];
  let depth = 0;
  let current: { op: string; args: number[] }[] = [];
  let args: number[] = [];
  for (const token of text.split(/\s+/).filter((part) => part !== '')) {
    const value = Number(token);
    if (!Number.isNaN(value) && /^[-+.\d]/.test(token)) {
      args.push(value);
      continue;
    }
    if (token === 'q') {
      if (depth === 0) current = [];
      depth += 1;
    } else if (token === 'Q') {
      depth -= 1;
      if (depth === 0) blocks.push(current);
    } else if (depth > 0) {
      current.push({ op: token, args });
    }
    args = [];
  }
  return { blocks, text };
}

/**
 * Bounding box of the path coordinates of a block (move, line and curve points).
 *
 * @param block - Operators of one graphics state block.
 * @returns Width and height in points.
 */
function pathExtent(block: ReadBack['blocks'][number]): { width: number; height: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const { op, args } of block) {
    if (op !== 'm' && op !== 'l' && op !== 'c') continue;
    for (let index = 0; index + 1 < args.length; index += 2) {
      xs.push(args[index] ?? 0);
      ys.push(args[index + 1] ?? 0);
    }
  }
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

/**
 * Reads the shown texts back as a text extractor does: each byte of the
 * `Tj` strings looked up in the ToUnicode table of the page's font.
 *
 * @param document - Loaded PDF.
 * @param content - Its decoded page content.
 * @returns Every shown string, in order, as Unicode.
 * @throws {Error} When the page has no font or the font has no ToUnicode table.
 */
function extractTexts(document: PDFDocument, content: ReadBack): string[] {
  const fonts = document.getPage(0).node.Resources()?.lookup(PDFName.of('Font'), PDFDict);
  const [fontRef] = fonts?.values() ?? [];
  if (fontRef === undefined) throw new Error('Page without font.');
  const font = document.context.lookup(fontRef, PDFDict);
  const toUnicode = font.lookup(PDFName.of('ToUnicode'));
  if (!(toUnicode instanceof PDFRawStream)) throw new Error('Font without ToUnicode table.');
  const cmap = new TextDecoder('latin1').decode(decodePDFRawStream(toUnicode).decode());
  const unicodeOf = new Map<number, string>();
  for (const [, code = '', unicode = ''] of cmap.matchAll(/<([0-9A-F]{2})> <([0-9A-F]{4})>/g)) {
    unicodeOf.set(Number.parseInt(code, 16), String.fromCodePoint(Number.parseInt(unicode, 16)));
  }
  return Array.from(content.text.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g), ([, hex = '']) =>
    Array.from(
      hex.matchAll(/../g),
      ([byte]) => unicodeOf.get(Number.parseInt(byte, 16)) ?? '?',
    ).join(''),
  );
}

/**
 * Builds a stencil PDF and loads it back.
 *
 * @param sigil - Sigil to print.
 * @param sizeCm - Print size.
 * @param strokeMm - Stroke on paper.
 * @param roundEnds - Line ends setting.
 * @param texts - Texts printed.
 * @returns The raw bytes and the loaded document.
 */
async function roundTrip(
  sigil: Sigil,
  sizeCm: number,
  strokeMm: number,
  roundEnds = true,
  texts = TEXTS_FR,
) {
  const page = layoutStencilPage(sigil, roundEnds, strokeMm, sizeCm, texts);
  const bytes = await buildStencilPdf(page, NOW);
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  return { bytes, document, content: readContent(document) };
}

describe('unit conversions', () => {
  it('converts 1 cm to 72 / 2.54 points', () => {
    expect(cmToPoints(1)).toBeCloseTo(72 / 2.54, 10);
    expect(cmToPoints(6)).toBeCloseTo((6 * 72) / 2.54, 10);
  });

  it('converts millimetres with 72 / 25.4 points each', () => {
    expect(PT_PER_MM).toBeCloseTo(2.834645669, 9);
    expect(mmToPoints(0.6)).toBeCloseTo((0.6 * 72) / 25.4, 10);
    expect(mmToPoints(A4_MM.width)).toBeCloseTo(595.2756, 4);
    expect(mmToPoints(A4_MM.height)).toBeCloseTo(841.8898, 4);
  });
});

describe('layoutStencilPage', () => {
  it('scales the ink to the size asked for and centres it in the printable area', () => {
    const page = layoutStencilPage(kamea(JE_SUIS_CALME), true, 0.6, 6, TEXTS_FR);

    expect(Math.max(page.inkMm.width, page.inkMm.height)).toBeCloseTo(60, 9);
    expect(page.lineWidth).toBeCloseTo(mmToPoints(0.6), 10);
    expect(page.fits).toBe(true);
    expect(page.maxSizeCm).toBe(25);
  });

  it('prints a tall sigil up to 25 cm, the height of the printable area', () => {
    const page = layoutStencilPage(kamea(JE_SUIS_CALME), true, 0.6, 25, TEXTS_FR);

    expect(page.inkMm.height).toBeCloseTo(250, 9);
    expect(page.inkMm.width).toBeLessThan(STENCIL_AREA_MM.width);
    expect(page.fits).toBe(true);
  });

  it('refuses a sigil too wide for an A4 portrait page and gives the largest size that fits', () => {
    const sigil = kamea(ABCD);
    const page = layoutStencilPage(sigil, true, 0.6, 25, TEXTS_FR);

    expect(page.fits).toBe(false);
    expect(page.maxSizeCm).toBeLessThan(25);
    expect(page.maxSizeCm).toBeGreaterThanOrEqual(STENCIL_AREA_MM.width / 10 - 1);
    const atMax = layoutStencilPage(sigil, true, 0.6, page.maxSizeCm, TEXTS_FR);
    const justAbove = layoutStencilPage(sigil, true, 0.6, page.maxSizeCm + 0.1, TEXTS_FR);
    expect(atMax.fits).toBe(true);
    expect(justAbove.fits).toBe(false);
  });

  it('places the ruler 1 cm long, its ticks on its ends', () => {
    const page = layoutStencilPage(kamea(JE_SUIS_CALME), true, 0.6, 6, TEXTS_FR);
    const [line] = page.ruler.paths;
    const ends = (line ?? []).flatMap((command) => ('to' in command ? [command.to] : []));

    expect(ends).toHaveLength(2);
    expect(Math.abs((ends[1]?.x ?? 0) - (ends[0]?.x ?? 0))).toBeCloseTo(cmToPoints(1), 10);
    expect(page.texts.map((text) => text.text)).toEqual([
      TEXTS_FR.ruler,
      TEXTS_FR.instruction,
      TEXTS_FR.details,
    ]);
  });

  it.each([0, -1, Number.NaN])('refuses the size %s', (size) => {
    expect(() => layoutStencilPage(kamea(JE_SUIS_CALME), true, 0.6, size, TEXTS_FR)).toThrow(
      RangeError,
    );
  });
});

describe('buildStencilPdf', () => {
  it.each([
    ['kamea, Saturn, 6 cm, 0.6 mm', () => kamea(JE_SUIS_CALME), 6, 0.6, true],
    [
      'kamea, Moon, 1 cm, 1.2 mm',
      () => kamea(['B', 'E', 'L', 'L', 'E', 'A', 'L', 'L', 'E', 'E'], 'moon'),
      1,
      1.2,
      true,
    ],
    ['kamea, flat ends, 12.5 cm, 0.3 mm', () => kamea(JE_SUIS_CALME), 12.5, 0.3, false],
    ['Spare, 6 cm, 0.6 mm', () => spare(JE_SUIS_CALME), 6, 0.6, true],
    ['Spare, 18 cm, 1.2 mm', () => spare(JE_SUIS_CALME), 18, 1.2, true],
  ] as const)(
    'prints %s at the size asked for (± 0.5 mm) on an A4 portrait page',
    async (_, make, sizeCm, strokeMm, roundEnds) => {
      const { document, content } = await roundTrip(make(), sizeCm, strokeMm, roundEnds);
      const page = document.getPage(0);
      const [sigilBlock] = content.blocks;
      if (sigilBlock === undefined) throw new Error('No sigil block.');

      expect(document.getPageCount()).toBe(1);
      expect(page.getWidth()).toBeCloseTo(mmToPoints(210), 2);
      expect(page.getHeight()).toBeCloseTo(mmToPoints(297), 2);
      const width = sigilBlock.find((operator) => operator.op === 'w')?.args[0];
      expect(width).toBeCloseTo(mmToPoints(strokeMm), 3);
      expect(sigilBlock.find((operator) => operator.op === 'RG')?.args).toEqual([0, 0, 0]);
      expect(sigilBlock.find((operator) => operator.op === 'J')?.args).toEqual([roundEnds ? 1 : 0]);
      // Ink edge of round ends: the geometry plus half a stroke on each side.
      const extent = pathExtent(sigilBlock);
      if (roundEnds) {
        const inkMm = (Math.max(extent.width, extent.height) + (width ?? 0)) / PT_PER_MM;
        expect(Math.abs(inkMm - sizeCm * 10)).toBeLessThanOrEqual(SIZE_TOLERANCE_MM);
      } else {
        // Flat ends: the ink lies within half a stroke of the geometry's box (miter tips aside).
        const geometryMm = Math.max(extent.width, extent.height) / PT_PER_MM;
        expect(geometryMm).toBeLessThanOrEqual(sizeCm * 10 + SIZE_TOLERANCE_MM);
        expect(geometryMm).toBeGreaterThanOrEqual(sizeCm * 10 - strokeMm - SIZE_TOLERANCE_MM);
      }
    },
  );

  it('draws the 1 cm control ruler in its own block, with the label and the instruction', async () => {
    const { content } = await roundTrip(kamea(JE_SUIS_CALME), 6, 0.6);
    const ruler = content.blocks[1];
    if (ruler === undefined) throw new Error('No ruler block.');
    const [line] = ruler.filter((operator) => operator.op === 'm' || operator.op === 'l');
    const lineEnd = ruler.find((operator, index) => index > 0 && operator.op === 'l');

    expect(Math.abs((lineEnd?.args[0] ?? 0) - (line?.args[0] ?? 0))).toBeCloseTo(cmToPoints(1), 3);
    expect(content.text).toMatch(/BT/);
    expect(content.blocks.length).toBeGreaterThanOrEqual(5);
  });

  it('writes neutral metadata: "Sigil", the export date, no tool name', async () => {
    const { bytes, document } = await roundTrip(kamea(JE_SUIS_CALME), 6, 0.6);
    const raw = new TextDecoder('latin1').decode(bytes);
    const info = document.context.lookup(document.context.trailerInfo.Info, PDFDict);

    expect(document.getTitle()).toBe('Sigil');
    expect(document.getCreator()).toBe('Sigil');
    expect(document.getProducer()).toBe('Sigil');
    expect(document.getCreationDate()?.getTime()).toBe(NOW.getTime());
    expect(document.getModificationDate()?.getTime()).toBe(NOW.getTime());
    expect(document.getAuthor()).toBeUndefined();
    expect(document.getSubject()).toBeUndefined();
    expect(document.getKeywords()).toBeUndefined();
    expect(raw).not.toMatch(/pdf-lib|hopding/i);
    // The info dictionary holds those five entries and nothing else.
    expect(
      info
        .keys()
        .map((key) => key.asString())
        .sort(),
    ).toEqual(['/CreationDate', '/Creator', '/ModDate', '/Producer', '/Title']);
  });

  it('never contains the intention', async () => {
    for (const sigil of [kamea(JE_SUIS_CALME), spare(JE_SUIS_CALME)]) {
      const { bytes, document, content } = await roundTrip(sigil, 6, 0.6);
      const raw = new TextDecoder('latin1').decode(bytes).toLowerCase();

      expect(raw).not.toContain('calme');
      expect(content.text.toLowerCase()).not.toContain('calme');
      expect(content.text.toUpperCase()).not.toContain('JESUISCALME');
      expect(document.getTitle()).toBe('Sigil');
    }
  });

  it.each([
    ['French', TEXTS_FR],
    ['English', TEXTS_EN],
  ])('prints the %s texts with the standard font', async (_, texts) => {
    await expect(roundTrip(kamea(JE_SUIS_CALME), 6, 0.6, true, texts)).resolves.toBeDefined();
  });

  it('reads its French notes back with their accents and apostrophe (B2)', async () => {
    const { document, content } = await roundTrip(kamea(JE_SUIS_CALME), 6, 0.6);
    const texts = extractTexts(document, content);

    expect(texts).toEqual([TEXTS_FR.ruler, TEXTS_FR.instruction, TEXTS_FR.details]);
    expect(texts.join(' ')).toMatch(/à.*l’échelle/);
  });

  it('sets the miter limit of the SVG with flat ends, and none with round ends', async () => {
    const flat = await roundTrip(kamea(JE_SUIS_CALME), 6, 0.6, false);
    const round = await roundTrip(kamea(JE_SUIS_CALME), 6, 0.6, true);
    const miter = (blocks: ReadBack['blocks']) =>
      blocks[0]?.find((operator) => operator.op === 'M')?.args;

    expect(miter(flat.content.blocks)).toEqual([lineEndsFor(false).strokeMiterlimit]);
    expect(flat.content.blocks[0]?.find((operator) => operator.op === 'j')?.args).toEqual([0]);
    expect(miter(round.content.blocks)).toBeUndefined();
  });

  it('refuses to write a page the sigil does not fit', async () => {
    const page = layoutStencilPage(kamea(ABCD), true, 0.6, 25, TEXTS_FR);

    await expect(buildStencilPdf(page, NOW)).rejects.toThrow(RangeError);
  });
});

describe('winAnsiToUnicodeCMap', () => {
  const cmap = winAnsiToUnicodeCMap();
  const entries = new Map(
    Array.from(cmap.matchAll(/<([0-9A-F]{2})> <([0-9A-F]{4})>/g), ([, code, unicode]) => [
      code,
      unicode,
    ]),
  );

  it('maps the WinAnsi codes the French notes use to their Unicode characters', () => {
    expect(entries.get('20')).toBe('0020');
    expect(entries.get('41')).toBe('0041');
    expect(entries.get('E0')).toBe('00E0'); // à
    expect(entries.get('E9')).toBe('00E9'); // é
    expect(entries.get('92')).toBe('2019'); // ’
    expect(entries.get('80')).toBe('20AC'); // €
    expect(entries.get('A0')).toBe('00A0'); // no-break space
  });

  it('leaves out the codes WinAnsi does not define', () => {
    for (const code of ['7F', '81', '8D', '8F', '90', '9D']) expect(entries.has(code)).toBe(false);
    expect(entries.size).toBe(0xff - 0x20 + 1 - 6);
  });

  it('keeps every bfchar block within the 100 entries the CMap format allows', () => {
    const counts = Array.from(cmap.matchAll(/(\d+) beginbfchar/g), ([, count]) => Number(count));
    expect(counts.every((count) => count > 0 && count <= 100)).toBe(true);
    expect(counts.reduce((total, count) => total + count, 0)).toBe(entries.size);
  });
});
