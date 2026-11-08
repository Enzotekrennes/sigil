/**
 * Independent acceptance spec of feature F5 (tattoo stencil mode and real-size
 * PDF), written from the four acceptance scenarios of docs/03-plan.md and run
 * against the production build.
 *
 * Covers: the stencil on screen (pure black, single line, no framing circle, no
 * background) for kamea and Spare on both themes; the PDF read back from its
 * bytes (A4 portrait, the ink of the sigil measured on its curves, stroke in
 * millimetres, 1 cm ruler, printing instruction in both languages, neutral
 * metadata, no intention); the size range and the too-wide refusal; the 4096 px
 * stencil PNG; the PDF exported offline; the dialog driven by keyboard; the
 * 375 px full-screen dialog; and the absence of Content Security Policy
 * violations and console errors.
 *
 * The PDF is parsed here with pdf-lib in read mode only; a second measurement
 * (PyMuPDF, 1200 dpi raster) was run by hand and is reported with the verdict.
 */
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

import {
  expect,
  test,
  type Download,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { decodePDFRawStream, PDFDict, PDFDocument, PDFRawStream } from 'pdf-lib';

import { waitForServiceWorkerControl } from './service-worker.ts';

/** Intention of the F1 scenario, in French and in English. */
const INTENTION_FR = 'Je suis calme';
const INTENTION_EN = 'I am calm';

/** PDF points per millimetre: 1 pt = 1/72 in, 1 in = 25.4 mm. */
const PT_PER_MM = 72 / 25.4;

/** A4 portrait in PDF points, as printed on the sheet (595.28 x 841.89). */
const A4_PT = { width: 595.28, height: 841.89 } as const;

/** Tolerance of the F5 scenario on the printed size, in millimetres. */
const SIZE_TOLERANCE_MM = 0.5;

/** Name of a PDF export: kind, local date and time, no intention. */
const PDF_NAME = /^sigil-(kamea|spare)-\d{8}-\d{6}\.pdf$/;

/** Printable width given by the app to a sigil, in millimetres (210 minus two 10 mm margins). */
const AREA_WIDTH_MM = 190;

/**
 * Pattern of a stroke read-out such as "0,6 mm" (the app separates the unit with a no-break space).
 *
 * @param value - Number as written in the French interface.
 * @returns The pattern.
 */
function millimetres(value: string): RegExp {
  return new RegExp(String.raw`^${value}\s?mm$`);
}

/** Operators of one top-level `q ... Q` block of a content stream. */
type Block = { op: string; args: number[] }[];

/** A page read back: its size, its drawing blocks and every text shown. */
interface ReadPdf {
  readonly document: PDFDocument;
  readonly raw: string;
  readonly blocks: Block[];
  readonly texts: string[];
}

/**
 * Starts collecting CSP violations and page errors before any script runs.
 *
 * @param page - Page not yet navigated.
 */
async function watchPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { cspViolations: violations });
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
}

/**
 * CSP violations seen so far.
 *
 * @param page - Page watched by `watchPage`.
 * @returns The violated directives with the blocked URI.
 */
async function cspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
}

/**
 * Records console errors and uncaught exceptions of a page.
 *
 * @param page - Page to watch.
 * @returns The live list of messages.
 */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Strings of one interface language. */
interface Wording {
  readonly intention: string;
  readonly trace: string;
  readonly export: string;
  readonly download: string;
  readonly cancel: string;
  readonly sizeField: string;
  readonly stencilSwitch: string;
  readonly strokeSlider: string;
}

const FR: Wording = {
  intention: INTENTION_FR,
  trace: 'Tracer',
  export: 'Exporter',
  download: 'Télécharger',
  cancel: 'Annuler',
  sizeField: 'Taille réelle (cm)',
  stencilSwitch: 'Pochoir tatouage',
  strokeSlider: 'Épaisseur',
};

const EN: Wording = {
  intention: INTENTION_EN,
  trace: 'Trace',
  export: 'Export',
  download: 'Download',
  cancel: 'Cancel',
  sizeField: 'Actual size (cm)',
  stencilSwitch: 'Tattoo stencil',
  strokeSlider: 'Width',
};

/** Options to draw a sigil. */
interface TraceOptions {
  readonly intention?: string;
  readonly method?: 'kamea' | 'spare';
  readonly planet?: string;
  readonly words?: Wording;
}

/**
 * Types an intention, picks the method and planet and draws the sigil.
 *
 * @param page - Page on the app.
 * @param options - Intention, method, planet and language.
 */
async function trace(page: Page, options: TraceOptions = {}): Promise<void> {
  const words = options.words ?? FR;
  if (options.method === 'spare') await page.getByText('Spare', { exact: true }).click();
  if (options.planet !== undefined) await page.getByText(options.planet).first().click();
  await page.getByLabel(/Intention/).fill(options.intention ?? words.intention);
  await page.getByRole('button', { name: words.trace, exact: true }).click();
  await expect(page.getByRole('button', { name: words.export, exact: true })).toBeEnabled();
}

/**
 * Opens the "Style" section when it starts folded.
 *
 * @param page - Page on the app.
 */
async function openStyle(page: Page): Promise<void> {
  const section = page.locator('details', { has: page.getByRole('heading', { name: 'Style' }) });
  if ((await section.getAttribute('open')) === null) {
    await page.getByRole('heading', { name: 'Style' }).click();
  }
}

/**
 * Turns the stencil mode on from the "Style" section.
 *
 * @param page - Page showing a sigil.
 * @param words - Interface language.
 */
async function enableStencil(page: Page, words: Wording = FR): Promise<void> {
  await openStyle(page);
  await page.getByRole('switch', { name: words.stencilSwitch }).check({ force: true });
}

/**
 * Opens the export dialog on the PDF format.
 *
 * @param page - Page showing a sigil.
 * @param format - Format to pick.
 * @param words - Interface language.
 * @returns The dialog.
 */
async function openExport(
  page: Page,
  format: 'SVG' | 'PNG' | 'PDF' = 'PDF',
  words: Wording = FR,
): Promise<Locator> {
  await page.getByRole('button', { name: words.export, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: format }).check({ force: true });
  return dialog;
}

/**
 * Presses the download button of the dialog and saves the file.
 *
 * @param page - Page with the dialog open.
 * @param testInfo - Current test, for its output folder.
 * @param words - Interface language.
 * @returns The download and the path where it was saved.
 */
async function download(
  page: Page,
  testInfo: TestInfo,
  words: Wording = FR,
): Promise<{ file: Download; path: string }> {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('dialog').getByRole('button', { name: words.download }).click(),
  ]);
  const path = testInfo.outputPath(file.suggestedFilename());
  await file.saveAs(path);
  return { file, path };
}

/**
 * Exports a PDF of the sigil shown and reads it back.
 *
 * @param page - Page showing a sigil.
 * @param testInfo - Current test.
 * @param sizeCm - Size typed in the dialog.
 * @param words - Interface language.
 * @returns The PDF read back, and the suggested file name.
 */
async function exportPdf(
  page: Page,
  testInfo: TestInfo,
  sizeCm: string,
  words: Wording = FR,
): Promise<{ pdf: ReadPdf; name: string }> {
  const dialog = await openExport(page, 'PDF', words);
  await dialog.getByRole('textbox', { name: words.sizeField }).fill(sizeCm);
  const { file, path } = await download(page, testInfo, words);
  return { pdf: await readPdf(await readFile(path)), name: file.suggestedFilename() };
}

/**
 * Decodes a PDF and splits its first page into top-level `q ... Q` blocks.
 *
 * @param bytes - The file.
 * @returns The page, the blocks (sigil first, then the ruler) and every text shown.
 * @throws {Error} When the page has no content stream.
 */
async function readPdf(bytes: Uint8Array): Promise<ReadPdf> {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const contents = document.getPage(0).node.Contents();
  if (contents === undefined) throw new Error('Page without content.');
  const refs = 'asArray' in contents ? contents.asArray() : [contents];
  let stream = '';
  for (const ref of refs) {
    const object = document.context.lookup(ref);
    if (!(object instanceof PDFRawStream)) throw new Error('Unexpected content stream.');
    stream += `${new TextDecoder('latin1').decode(decodePDFRawStream(object).decode())}\n`;
  }
  const blocks: Block[] = [];
  const texts: string[] = [];
  let depth = 0;
  let current: Block = [];
  let args: number[] = [];
  for (const token of stream.split(/\s+/).filter((part) => part !== '')) {
    if (/^<[0-9A-Fa-f]*>$/.test(token)) {
      // WinAnsi text shown by the standard Helvetica font: one byte per character.
      texts.push(new TextDecoder('windows-1252').decode(Buffer.from(token.slice(1, -1), 'hex')));
      continue;
    }
    if (/^[-+.\d]/.test(token) && !Number.isNaN(Number(token))) {
      args.push(Number(token));
      continue;
    }
    if (token === 'q') {
      if (depth === 0) current = [];
      depth += 1;
    } else if (token === 'Q') {
      depth -= 1;
      if (depth === 0) blocks.push(current);
    } else if (depth > 0) current.push({ op: token, args });
    args = [];
  }
  return { document, raw: Buffer.from(bytes).toString('latin1'), blocks, texts };
}

/**
 * Bounding box of the centre line of a block, with each Bézier curve sampled
 * densely (control points would overestimate it).
 *
 * @param block - Operators of one block.
 * @returns The box in PDF points.
 */
function centreLineBox(block: Block): { x0: number; y0: number; x1: number; y1: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  let at = { x: 0, y: 0 };
  for (const { op, args } of block) {
    if (op === 'm' || op === 'l') {
      at = { x: args[0] ?? 0, y: args[1] ?? 0 };
      xs.push(at.x);
      ys.push(at.y);
    } else if (op === 'c') {
      const [x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0] = args;
      for (let step = 1; step <= 200; step += 1) {
        const t = step / 200;
        const u = 1 - t;
        xs.push(u ** 3 * at.x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3);
        ys.push(u ** 3 * at.y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3);
      }
      at = { x: x3, y: y3 };
    }
  }
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
}

/**
 * Largest dimension of the ink of the sigil block, stroke included (round ends
 * and joins: half a stroke beyond the centre line on every side).
 *
 * @param block - The sigil's block.
 * @returns Width, height and largest dimension, in millimetres.
 */
function inkMm(block: Block): { width: number; height: number; largest: number; strokeMm: number } {
  const box = centreLineBox(block);
  const stroke = block.find((operator) => operator.op === 'w')?.args[0] ?? 0;
  const width = (box.x1 - box.x0 + stroke) / PT_PER_MM;
  const height = (box.y1 - box.y0 + stroke) / PT_PER_MM;
  return { width, height, largest: Math.max(width, height), strokeMm: stroke / PT_PER_MM };
}

/**
 * Splits a PDF's blocks into sigil and ruler, failing when one is missing.
 *
 * @param pdf - PDF read back.
 * @returns The sigil block and the ruler block.
 * @throws {Error} When the page does not hold both.
 */
function sigilAndRuler(pdf: ReadPdf): { sigil: Block; ruler: Block } {
  const [sigil, ruler] = pdf.blocks;
  if (sigil === undefined || ruler === undefined) throw new Error('Missing sigil or ruler block.');
  return { sigil, ruler };
}

/**
 * Computed colours of every shape of the sigil on screen.
 *
 * @param page - Page showing a sigil.
 * @returns Strokes, fills, stroke widths, tags and the stage background.
 */
async function drawnStyles(page: Page) {
  return page.getByRole('img', { name: /^Sigil/ }).evaluate((svg) => ({
    shapes: Array.from(
      svg.querySelectorAll('path, circle, line, rect, ellipse, polyline'),
      (element) => {
        const style = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          klass: element.getAttribute('class') ?? '',
          stroke: style.stroke,
          fill: style.fill,
          width: style.strokeWidth,
          opacity: style.opacity,
        };
      },
    ),
    stage: getComputedStyle(svg.parentElement ?? svg).backgroundColor,
  }));
}

for (const theme of ['light', 'dark'] as const) {
  for (const method of ['kamea', 'spare'] as const) {
    test(`scenario 1: the ${method} stencil is pure black, a single line, no frame, no background on the ${theme} theme`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await watchPage(page);
      const errors = collectErrors(page);
      await page.goto('./');
      await trace(page, { method });
      await openStyle(page);
      // The frame circle is on by default in the normal style; it must vanish with the stencil.
      await expect(page.getByRole('switch', { name: 'Cercle d’encadrement' })).toBeVisible();
      await enableStencil(page);

      const sigil = page.getByRole('img', { name: /^Sigil/ });
      await expect(sigil.locator('.sigil-renderer__frame')).toHaveCount(0);
      await expect(page.getByRole('switch', { name: 'Cercle d’encadrement' })).toHaveCount(0);
      // The trace animation runs first: wait for the pen to finish before judging the colours.
      await expect
        .poll(
          async () => {
            const shapes = (await drawnStyles(page)).shapes.filter(
              (shape) => shape.stroke !== 'none',
            );
            return new Set(shapes.map((shape) => shape.opacity));
          },
          { timeout: 15_000 },
        )
        .toEqual(new Set(['1']));
      const styles = await drawnStyles(page);
      const drawn = styles.shapes.filter((shape) => shape.stroke !== 'none');
      expect(drawn.length).toBeGreaterThan(0);
      // Pure black stroke, nothing filled, one single width, fully opaque.
      expect(new Set(drawn.map((shape) => shape.stroke))).toEqual(new Set(['rgb(0, 0, 0)']));
      expect(new Set(drawn.map((shape) => shape.fill))).toEqual(new Set(['none']));
      expect(new Set(drawn.map((shape) => shape.width)).size).toBe(1);
      expect(new Set(drawn.map((shape) => shape.opacity))).toEqual(new Set(['1']));
      // No decorative circle other than the start mark of a kamea (which is a mark, not a frame).
      const circles = styles.shapes.filter((shape) => shape.tag === 'circle');
      expect(circles.length).toBeLessThanOrEqual(method === 'kamea' ? 1 : 0);
      // No background: pure white stage whatever the theme, no filled rectangle.
      expect(styles.stage).toBe('rgb(255, 255, 255)');
      expect(styles.shapes.filter((shape) => shape.tag === 'rect')).toEqual([]);
      if (method === 'kamea') {
        await expect(sigil).toHaveClass(/sigil-renderer--single-stroke/);
        expect(styles.shapes.filter((shape) => shape.tag === 'path')).toHaveLength(1);
      }
      await expect(page.getByRole('switch', { name: 'Pochoir tatouage' })).toBeChecked();
      expect(await cspViolations(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test('scenario 4: the stroke is in millimetres, 0.6 by default, from 0.3 to 1.2 (stencil on screen)', async ({
  page,
}) => {
  await page.goto('./');
  await trace(page);
  await enableStencil(page);
  const slider = page.getByRole('slider', { name: 'Épaisseur' });

  await expect(slider).toHaveAttribute('aria-valuetext', millimetres('0,6'));
  await expect(slider).toHaveAttribute('min', '0.3');
  await expect(slider).toHaveAttribute('max', '1.2');
  await expect(slider).toHaveAttribute('step', '0.1');
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuetext', millimetres('0,3'));
  await page.keyboard.press('ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuetext', millimetres('0,3'));
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuetext', millimetres('1,2'));
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', millimetres('1,2'));
});

for (const [label, options] of [
  ['kamea Saturne', {}],
  ['kamea Lune', { planet: 'Lune' }],
  ['Spare', { method: 'spare' as const }],
] as const) {
  test(`scenario 2: a 6 cm PDF of ${label} measures 6 cm ± 0.5 mm on an A4 page with a 1 cm ruler`, async ({
    page,
  }, testInfo) => {
    await watchPage(page);
    const errors = collectErrors(page);
    await page.goto('./');
    await trace(page, options);
    const { pdf, name } = await exportPdf(page, testInfo, '6');
    const { sigil, ruler } = sigilAndRuler(pdf);

    expect(name).toMatch(PDF_NAME);
    // One A4 portrait page, 595.28 x 841.89 pt.
    expect(pdf.document.getPageCount()).toBe(1);
    expect(pdf.document.getPage(0).getWidth()).toBeCloseTo(A4_PT.width, 1);
    expect(pdf.document.getPage(0).getHeight()).toBeCloseTo(A4_PT.height, 1);
    // The largest dimension of the ink, stroke included, is 60 mm.
    const ink = inkMm(sigil);
    expect(Math.abs(ink.largest - 60)).toBeLessThanOrEqual(SIZE_TOLERANCE_MM);
    // Pure black stroke, default 0.6 mm.
    expect(sigil.find((operator) => operator.op === 'RG')?.args).toEqual([0, 0, 0]);
    expect(ink.strokeMm).toBeCloseTo(0.6, 3);
    // Control ruler: 1 cm = 28.35 pt between its two ticks, labelled "1 cm".
    const rulerBox = centreLineBox(ruler);
    expect(rulerBox.x1 - rulerBox.x0).toBeCloseTo(28.35, 1);
    expect((rulerBox.x1 - rulerBox.x0) / PT_PER_MM).toBeCloseTo(10, 2);
    expect(pdf.texts).toContain('1 cm');
    // The ink stays inside the page margins (at least 5 mm of printer margin).
    const box = centreLineBox(sigil);
    expect(box.x0 / PT_PER_MM).toBeGreaterThan(5);
    expect(A4_PT.width / PT_PER_MM - box.x1 / PT_PER_MM).toBeGreaterThan(5);
    expect(await cspViolations(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const [size, expected] of [
  ['1', 10],
  ['8', 80],
  ['25', 250],
  ['6,5', 65],
  ['6.5', 65],
] as const) {
  test(`scenario 2: a ${size} cm size gives ${String(expected)} mm of ink`, async ({
    page,
  }, testInfo) => {
    await page.goto('./');
    await trace(page);
    const { pdf } = await exportPdf(page, testInfo, size);
    expect(Math.abs(inkMm(sigilAndRuler(pdf).sigil).largest - expected)).toBeLessThanOrEqual(
      SIZE_TOLERANCE_MM,
    );
  });
}

test('scenario 3: sizes out of range show the range and block the export, boundaries pass', async ({
  page,
}) => {
  await page.goto('./');
  await trace(page);
  const dialog = await openExport(page);
  const size = dialog.getByRole('textbox', { name: 'Taille réelle (cm)' });
  const button = dialog.getByRole('button', { name: 'Télécharger' });
  await expect(size).toHaveValue('8');

  let downloads = 0;
  page.on('download', () => {
    downloads += 1;
  });
  for (const value of ['0,5', '0.99', '0,9999', '25,1', '26', '30', '999999999999', '0']) {
    await size.fill(value);
    await expect(size).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByText('La taille doit être comprise entre 1 et 25 cm.')).toBeVisible();
    await expect(button).toBeDisabled();
    await button.click({ force: true });
    await size.press('Enter');
  }
  for (const value of ['-3', '', '  ', 'abc', '6cm', '1e1', '1 000']) {
    await size.fill(value);
    await expect(size).toHaveAttribute('aria-invalid', 'true');
    await expect(button).toBeDisabled();
    await expect(
      dialog.getByRole('alert').or(dialog.locator('#export-size-error')),
    ).not.toBeEmpty();
  }
  await page.waitForTimeout(500);
  expect(downloads).toBe(0);
  await expect(dialog).toBeVisible();
  for (const value of ['1', '25', '25,0', '1,0']) {
    await size.fill(value);
    await expect(size).toHaveAttribute('aria-invalid', 'false');
    await expect(button).toBeEnabled();
  }
});

test.describe('in English', () => {
  test.use({ locale: 'en-US' });

  test('scenario 3: the range message is shown in English too', async ({ page }) => {
    await page.goto('./');
    await trace(page, { words: EN });
    const dialog = await openExport(page, 'PDF', EN);
    const size = dialog.getByRole('textbox', { name: EN.sizeField });
    for (const value of ['0.5', '30']) {
      await size.fill(value);
      await expect(dialog.getByText('The size must be between 1 and 25 cm.')).toBeVisible();
      await expect(dialog.getByRole('button', { name: EN.download })).toBeDisabled();
    }
  });
});

test('scenario 4: the stroke set in the Style section or the dialog is the stroke of the PDF', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  await trace(page);
  await enableStencil(page);
  const slider = page.getByRole('slider', { name: 'Épaisseur' });
  await slider.focus();
  await page.keyboard.press('Home');
  for (let press = 0; press < 6; press += 1) await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', millimetres('0,9'));

  // Style slider -> dialog slider -> PDF.
  const dialog = await openExport(page);
  await expect(dialog.getByRole('slider')).toHaveAttribute('aria-valuetext', millimetres('0,9'));
  await dialog.getByRole('textbox', { name: 'Taille réelle (cm)' }).fill('6');
  const first = await download(page, testInfo);
  const pdf09 = await readPdf(await readFile(first.path));
  expect(inkMm(sigilAndRuler(pdf09).sigil).strokeMm).toBeCloseTo(0.9, 3);
  expect(Math.abs(inkMm(sigilAndRuler(pdf09).sigil).largest - 60)).toBeLessThanOrEqual(
    SIZE_TOLERANCE_MM,
  );

  // Both ends of the range, set from the dialog.
  for (const [key, mm] of [
    ['Home', 0.3],
    ['End', 1.2],
  ] as const) {
    const again = await openExport(page);
    await again.getByRole('slider').focus();
    await page.keyboard.press(key);
    const { path } = await download(page, testInfo);
    const pdf = await readPdf(await readFile(path));
    const ink = inkMm(sigilAndRuler(pdf).sigil);
    expect(ink.strokeMm).toBeCloseTo(mm, 3);
    expect(Math.abs(ink.largest - 60)).toBeLessThanOrEqual(SIZE_TOLERANCE_MM);
    // The Style section followed.
    await expect(slider).toHaveAttribute(
      'aria-valuetext',
      millimetres(String(mm).replace('.', ',')),
    );
  }
});

test('a 25 cm sigil printed with the widest stroke still measures 25 cm and fits the page', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  await trace(page);
  const dialog = await openExport(page);
  await dialog.getByRole('slider').focus();
  await page.keyboard.press('End');
  await dialog.getByRole('textbox', { name: 'Taille réelle (cm)' }).fill('25');
  const { path } = await download(page, testInfo);
  const ink = inkMm(sigilAndRuler(await readPdf(await readFile(path))).sigil);
  expect(Math.abs(ink.largest - 250)).toBeLessThanOrEqual(SIZE_TOLERANCE_MM);
  expect(ink.strokeMm).toBeCloseTo(1.2, 3);
});

test('a sigil too wide for the sheet is refused with a clear message, and its maximum size prints', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  await trace(page, { method: 'spare' });
  const dialog = await openExport(page);
  const size = dialog.getByRole('textbox', { name: 'Taille réelle (cm)' });
  const button = dialog.getByRole('button', { name: 'Télécharger' });

  await size.fill('25');
  await expect(
    dialog.getByText('Trop grand pour une page A4 : ce sigil tient au plus sur 19 cm.'),
  ).toBeVisible();
  await expect(size).toHaveAttribute('aria-invalid', 'true');
  await expect(button).toBeDisabled();

  // The maximum announced really prints, within the printable width.
  await size.fill('19');
  await expect(size).toHaveAttribute('aria-invalid', 'false');
  const { path } = await download(page, testInfo);
  const ink = inkMm(sigilAndRuler(await readPdf(await readFile(path))).sigil);
  expect(ink.largest).toBeLessThanOrEqual(AREA_WIDTH_MM + 0.05);
  expect(Math.abs(ink.largest - 190)).toBeLessThanOrEqual(SIZE_TOLERANCE_MM);
});

test('the PDF carries the printing instruction in French and in English', async ({
  page,
  browser,
}, testInfo) => {
  await page.goto('./');
  await trace(page);
  const fr = (await exportPdf(page, testInfo, '6')).pdf;
  expect(fr.texts).toEqual([
    '1 cm',
    'Imprimer à 100 %, sans mise à l’échelle ni ajustement à la page.',
    'Sigil : 6 cm dans sa plus grande dimension, trait de 0,6 mm.',
  ]);

  const context = await browser.newContext({ locale: 'en-US' });
  const english = await context.newPage();
  await english.goto(new URL('./', page.url()).href);
  await trace(english, { words: EN });
  const en = (await exportPdf(english, testInfo, '6', EN)).pdf;
  expect(en.texts[0]).toBe('1 cm');
  expect(en.texts[1]).toMatch(/^Print at 100%, with no scaling and no \W?fit to page\W?\.$/);
  expect(en.texts[1]).toContain('fit to page');
  expect(en.texts[2]).toMatch(/^Sigil: 6\s?cm along its largest dimension, 0\.6\s?mm stroke\.$/);
  await context.close();
});

test('the PDF has neutral metadata and never contains the intention, its letters or the tool name', async ({
  page,
}, testInfo) => {
  const intention = 'Éè à ç <script> & "quote" 日本 Je suis calme';
  await page.goto('./');
  await trace(page, { intention });
  const { pdf, name } = await exportPdf(page, testInfo, '6');

  expect(name).toMatch(PDF_NAME);
  expect(pdf.document.getTitle()).toBe('Sigil');
  expect(pdf.document.getCreator()).toBe('Sigil');
  expect(pdf.document.getProducer()).toBe('Sigil');
  expect(pdf.document.getAuthor()).toBeUndefined();
  expect(pdf.document.getSubject()).toBeUndefined();
  expect(pdf.document.getKeywords()).toBeUndefined();
  const info = pdf.document.context.lookup(pdf.document.context.trailerInfo.Info, PDFDict);
  expect(
    info
      .keys()
      .map((key) => key.asString())
      .sort(),
  ).toEqual(['/CreationDate', '/Creator', '/ModDate', '/Producer', '/Title']);
  // Nothing in the file, compressed streams included, names the generator, the intention or its letters.
  let everything = pdf.raw;
  for (const object of pdf.document.context.enumerateIndirectObjects()) {
    const value = object[1];
    if (value instanceof PDFRawStream) {
      everything += `\n${Buffer.from(decodePDFRawStream(value).decode()).toString('latin1')}`;
      try {
        everything += `\n${inflateSync(Buffer.from(value.contents)).toString('latin1')}`;
      } catch {
        // Not a deflate stream: already decoded above.
      }
    }
  }
  const lowered = everything.toLowerCase();
  for (const forbidden of [
    'pdf-lib',
    'hopding',
    'calme',
    'script',
    'quote',
    'jsclm',
    'suis',
    'x-image',
    'xmp',
  ]) {
    expect(lowered, forbidden).not.toContain(forbidden);
  }
  expect(pdf.texts.join(' ')).not.toMatch(/calme|suis|script|quote/i);
});

test('the stencil PNG at 4096 px is pure black on pure white, opaque, with no coloured pixel', async ({
  page,
  context,
}, testInfo) => {
  await watchPage(page);
  const errors = collectErrors(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');
  await trace(page);
  await enableStencil(page);
  const dialog = await openExport(page, 'PNG');
  await dialog.getByRole('radio', { name: '4096 px' }).check({ force: true });
  const { file, path } = await download(page, testInfo);
  expect(file.suggestedFilename()).toMatch(/^sigil-kamea-\d{8}-\d{6}\.png$/);
  const bytes = await readFile(path);

  // Decoded in a blank page of the same browser (the app's own page has the strict CSP).
  const probe = await context.newPage();
  const stats = await probe.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const drawing = canvas.getContext('2d', { willReadFrequently: true });
    if (drawing === null) throw new Error('No 2d context.');
    drawing.drawImage(image, 0, 0);
    const { data, width, height } = drawing.getImageData(0, 0, canvas.width, canvas.height);
    let coloured = 0;
    let black = 0;
    let white = 0;
    let translucent = 0;
    for (let index = 0; index < data.length; index += 4) {
      const [r = 0, g = 0, b = 0, a = 0] = [
        data[index],
        data[index + 1],
        data[index + 2],
        data[index + 3],
      ];
      if (r !== g || g !== b) coloured += 1;
      if (a !== 255) translucent += 1;
      if (r === 0 && g === 0 && b === 0) black += 1;
      if (r === 255 && g === 255 && b === 255) white += 1;
    }
    return { width, height, coloured, translucent, black, white, total: width * height };
  }, bytes.toString('base64'));
  await probe.close();

  expect(stats.width).toBe(4096);
  expect(stats.height).toBe(4096);
  expect(stats.coloured).toBe(0);
  expect(stats.translucent).toBe(0);
  expect(stats.black).toBeGreaterThan(10_000);
  // Only the grey anti-aliasing of the line edges lies between pure black and pure white.
  expect((stats.total - stats.black - stats.white) / stats.total).toBeLessThan(0.01);
  expect(await cspViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('the PDF can be exported offline after a first visit, without any request leaving the app', async ({
  page,
  context,
}, testInfo) => {
  await page.goto('./');
  await waitForServiceWorkerControl(page);
  await context.setOffline(true);
  await page.reload();
  await trace(page);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const { pdf, name } = await exportPdf(page, testInfo, '6');

  expect(name).toMatch(PDF_NAME);
  expect(Math.abs(inkMm(sigilAndRuler(pdf).sigil).largest - 60)).toBeLessThanOrEqual(
    SIZE_TOLERANCE_MM,
  );
  const origin = new URL(page.url()).origin;
  expect(requests.filter((url) => !url.startsWith(origin) && !/^(blob|data):/.test(url))).toEqual(
    [],
  );
  await context.setOffline(false);
});

/**
 * Whether focus is inside the dialog.
 *
 * @param dialog - The dialog.
 * @returns True when the active element is the dialog or one of its descendants.
 */
async function focusInside(dialog: Locator): Promise<boolean> {
  return dialog.evaluate((element) => element.contains(document.activeElement));
}

test('the dialog is driven by keyboard: focus trapped, Escape and Cancel give the focus back', async ({
  page,
}) => {
  await watchPage(page);
  await page.goto('./');
  await trace(page);
  const opener = page.getByRole('button', { name: 'Exporter', exact: true });
  await opener.focus();

  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName(/Exporter/);
  expect(await focusInside(dialog)).toBe(true);
  // Forward and backward, far more presses than there are fields: the focus never leaves.
  for (let press = 0; press < 20; press += 1) {
    await page.keyboard.press('Tab');
    expect(await focusInside(dialog)).toBe(true);
  }
  for (let press = 0; press < 20; press += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await focusInside(dialog)).toBe(true);
  }
  // The format is chosen with the arrow keys, then the PDF fields are reachable.
  await dialog.getByRole('radio', { name: 'SVG' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('radio', { name: 'PDF' })).toBeChecked();
  for (let press = 0; press < 12; press += 1) {
    await page.keyboard.press('Tab');
    expect(await focusInside(dialog)).toBe(true);
  }
  await dialog.getByRole('textbox', { name: 'Taille réelle (cm)' }).focus();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  // Reopened with the mouse, closed with Cancel: the focus still comes back.
  await opener.click();
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await cspViolations(page)).toEqual([]);
});

test('the dialog gives the focus back after a PDF download and downloads once on a double click', async ({
  page,
}) => {
  await page.goto('./');
  await trace(page);
  const dialog = await openExport(page);
  let downloads = 0;
  page.on('download', () => {
    downloads += 1;
  });
  await dialog.getByRole('button', { name: 'Télécharger' }).dblclick();
  await expect(dialog).toHaveCount(0);
  await page.waitForTimeout(800);
  expect(downloads).toBe(1);
  await expect(page.getByRole('button', { name: 'Exporter', exact: true })).toBeFocused();
});

test.describe('on a 375 px phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test('the dialog fills the screen, nothing scrolls sideways and the buttons stay reachable', async ({
    page,
  }) => {
    await watchPage(page);
    await page.goto('./');
    await trace(page);
    await enableStencil(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );

    const dialog = await openExport(page);
    const box = await dialog.boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0, width: 375, height: 812 });
    const size = dialog.getByRole('textbox', { name: 'Taille réelle (cm)' });
    await size.fill('30');
    await expect(dialog.getByText('La taille doit être comprise entre 1 et 25 cm.')).toBeVisible();
    expect(await dialog.evaluate((element) => [element.scrollWidth, element.clientWidth])).toEqual([
      375, 375,
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );
    for (const name of ['Annuler', 'Télécharger']) {
      const button = await dialog.getByRole('button', { name }).boundingBox();
      expect(button?.height).toBeGreaterThanOrEqual(44);
      expect(button?.x).toBeGreaterThanOrEqual(0);
      expect((button?.x ?? 0) + (button?.width ?? 0)).toBeLessThanOrEqual(375);
      expect((button?.y ?? 0) + (button?.height ?? 0)).toBeLessThanOrEqual(812);
    }
    await expect(dialog.getByRole('button', { name: 'Télécharger' })).toBeDisabled();
    expect(await cspViolations(page)).toEqual([]);
  });
});
