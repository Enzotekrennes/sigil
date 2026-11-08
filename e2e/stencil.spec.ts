/**
 * End-to-end journey of feature F5 (tattoo stencil and real-size PDF) on the
 * production build: the stencil mode in pure black on pure white whatever the
 * theme, the width in millimetres; the "Exporter" dialog driven by keyboard
 * (focus kept inside, Escape, focus given back, reopened at once by Enter); a print size out of range
 * explained and blocked; a PDF downloaded and read back (A4 portrait, sigil
 * 6 cm ± 0.5 mm, stroke in points, 1 cm ruler, neutral metadata, no
 * intention); a 4096 px PNG; a PDF exported offline; and no Content Security
 * Policy violation along the way.
 */
import { readFile } from 'node:fs/promises';

import { expect, test, type Download, type Page, type TestInfo } from '@playwright/test';
import { decodePDFRawStream, PDFDict, PDFDocument, PDFRawStream } from 'pdf-lib';

import { waitForServiceWorkerControl } from './service-worker.ts';

/** Intention of the F1 scenario. */
const INTENTION = 'Je suis calme';

/** PDF points per millimetre. */
const PT_PER_MM = 72 / 25.4;

/** Tolerance of the F5 scenario on the printed size, in millimetres. */
const SIZE_TOLERANCE_MM = 0.5;

/** Neutral name of a stencil PDF (decision D8). */
const PDF_NAME = /^sigil-kamea-\d{8}-\d{6}\.pdf$/;

/**
 * Starts collecting CSP violations before any script of the page runs.
 *
 * @param page - Page not yet navigated.
 */
async function watchCsp(page: Page): Promise<void> {
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
 * @param page - Page watched by `watchCsp`.
 * @returns The violated directives with the blocked URI.
 */
async function cspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
}

/**
 * Types the intention and presses the "Tracer" button.
 *
 * @param page - Page on the app.
 */
async function trace(page: Page): Promise<void> {
  await page.getByLabel('Intention').fill(INTENTION);
  await page.getByRole('button', { name: 'Tracer' }).click();
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
 * Opens the export dialog and picks a format.
 *
 * @param page - Page showing a sigil.
 * @param format - Label of the format.
 * @returns The dialog.
 */
async function openExport(page: Page, format: 'SVG' | 'PNG' | 'PDF') {
  await page.getByRole('button', { name: 'Exporter' }).click();
  const dialog = page.getByRole('dialog', { name: 'Exporter le sigil' });
  await dialog.getByRole('radio', { name: format }).check({ force: true });
  return dialog;
}

/**
 * Presses "Télécharger" in the dialog and waits for the file.
 *
 * @param page - Page with the export dialog open.
 * @param testInfo - Current test, for its output folder.
 * @returns The download and the saved file's path.
 */
async function download(page: Page, testInfo: TestInfo): Promise<{ file: Download; path: string }> {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('dialog').getByRole('button', { name: 'Télécharger' }).click(),
  ]);
  const path = testInfo.outputPath(file.suggestedFilename());
  await file.saveAs(path);
  return { file, path };
}

/** Operators of one top-level `q … Q` block of a content stream. */
type Block = { op: string; args: number[] }[];

/**
 * Decodes the first page's content and splits it into top-level graphics state blocks.
 *
 * @param document - Loaded PDF.
 * @returns The blocks (sigil first, then the ruler, then the texts) and the raw text.
 */
function contentBlocks(document: PDFDocument): { blocks: Block[]; text: string } {
  const contents = document.getPage(0).node.Contents();
  if (contents === undefined) throw new Error('Page without content.');
  const refs = 'asArray' in contents ? contents.asArray() : [contents];
  let text = '';
  for (const ref of refs) {
    const stream = document.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) throw new Error('Unexpected content stream.');
    text += `${new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode())}\n`;
  }
  const blocks: Block[] = [];
  let depth = 0;
  let current: Block = [];
  let args: number[] = [];
  for (const token of text.split(/\s+/).filter((part) => part !== '')) {
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
  return { blocks, text };
}

/**
 * Width and height of the path points of a block.
 *
 * @param block - Operators of one block.
 * @returns The extent in points.
 */
function extent(block: Block): { width: number; height: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const { op, args } of block) {
    if (op !== 'm' && op !== 'l' && op !== 'c') continue;
    for (let index = 0; index + 1 < args.length; index += 2) {
      xs.push(args[index] ?? 0);
      ys.push(args[index + 1] ?? 0);
    }
  }
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

for (const theme of ['light', 'dark'] as const) {
  test(`draws the stencil in pure black on pure white on the ${theme} theme, without circle (F5)`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    await watchCsp(page);
    await page.goto('./');
    await openStyle(page);
    await page.getByRole('switch', { name: 'Cercle d’encadrement' }).check({ force: true });
    await trace(page);
    await page.getByRole('switch', { name: 'Pochoir tatouage' }).check({ force: true });

    const sigil = page.getByRole('img', { name: /^Sigil kamea/ });
    await expect(sigil.locator('circle.sigil-renderer__frame')).toHaveCount(0);
    await expect(page.getByRole('switch', { name: 'Cercle d’encadrement' })).toHaveCount(0);
    await expect(page.getByRole('slider', { name: 'Épaisseur' })).toHaveAttribute(
      'aria-valuetext',
      '0,6 mm',
    );
    const colours = await sigil.evaluate((svg) => ({
      strokes: Array.from(
        svg.querySelectorAll('path, circle, line'),
        (element) => getComputedStyle(element).stroke,
      ),
      stage: getComputedStyle(svg.parentElement ?? svg).backgroundColor,
    }));
    expect(new Set(colours.strokes)).toEqual(new Set(['rgb(0, 0, 0)']));
    expect(colours.stage).toBe('rgb(255, 255, 255)');
    expect(await cspViolations(page)).toEqual([]);
  });
}

test('opens, traps and closes the export dialog with the keyboard (F5)', async ({ page }) => {
  await watchCsp(page);
  await page.goto('./');
  await trace(page);
  const opener = page.getByRole('button', { name: 'Exporter' });
  await opener.focus();

  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Exporter le sigil' });
  await expect(dialog).toBeVisible();
  // The focus is inside and stays inside, however many times Tab is pressed.
  for (let press = 0; press < 12; press += 1) {
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press(press % 3 === 2 ? 'Shift+Tab' : 'Tab');
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await cspViolations(page)).toEqual([]);
});

test('reopens the export dialog on Enter right after Escape, every time (F5)', async ({ page }) => {
  await page.goto('./');
  await trace(page);
  const opener = page.getByRole('button', { name: 'Exporter' });
  const dialog = page.getByRole('dialog', { name: 'Exporter le sigil' });
  await opener.focus();

  for (let round = 0; round < 5; round += 1) {
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    // No wait between the two keys: Enter lands before the queued `close` event.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(50);
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  }
});

test('explains a print size out of range and blocks the PDF (F5)', async ({ page }) => {
  await page.goto('./');
  await trace(page);
  const dialog = await openExport(page, 'PDF');
  const size = dialog.getByRole('textbox', { name: 'Taille réelle (cm)' });
  const downloadButton = dialog.getByRole('button', { name: 'Télécharger' });

  for (const value of ['0,5', '30']) {
    await size.fill(value);
    await expect(size).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByText('La taille doit être comprise entre 1 et 25 cm.')).toBeVisible();
    await expect(downloadButton).toBeDisabled();
  }
  await size.fill('6');
  await expect(size).toHaveAttribute('aria-invalid', 'false');
  await expect(downloadButton).toBeEnabled();
});

test('downloads a 6 cm stencil PDF that measures 6 cm, with a 1 cm ruler and neutral metadata (F5)', async ({
  page,
}, testInfo) => {
  await watchCsp(page);
  await page.goto('./');
  await trace(page);
  const dialog = await openExport(page, 'PDF');
  await dialog.getByRole('textbox', { name: 'Taille réelle (cm)' }).fill('6');

  const { file, path } = await download(page, testInfo);
  expect(file.suggestedFilename()).toMatch(PDF_NAME);
  const bytes = await readFile(path);
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const pdfPage = document.getPage(0);
  const { blocks, text } = contentBlocks(document);
  const [sigil, ruler] = blocks;
  if (sigil === undefined || ruler === undefined) throw new Error('Missing sigil or ruler.');

  // A4 portrait.
  expect(document.getPageCount()).toBe(1);
  expect(pdfPage.getWidth() / PT_PER_MM).toBeCloseTo(210, 1);
  expect(pdfPage.getHeight() / PT_PER_MM).toBeCloseTo(297, 1);
  // 0.6 mm stroke, pure black, ink of 60 mm along its largest side (round ends: + one stroke).
  const width = sigil.find((operator) => operator.op === 'w')?.args[0] ?? 0;
  expect(width / PT_PER_MM).toBeCloseTo(0.6, 3);
  expect(sigil.find((operator) => operator.op === 'RG')?.args).toEqual([0, 0, 0]);
  const { width: inkWidth, height: inkHeight } = extent(sigil);
  const inkMm = (Math.max(inkWidth, inkHeight) + width) / PT_PER_MM;
  expect(Math.abs(inkMm - 60)).toBeLessThanOrEqual(SIZE_TOLERANCE_MM);
  // Control ruler: 1 cm between its ticks.
  expect(extent(ruler).width / PT_PER_MM).toBeCloseTo(10, 3);
  expect(text).toContain('BT');
  // Neutral metadata, no tool name, no intention.
  const raw = bytes.toString('latin1');
  expect(document.getTitle()).toBe('Sigil');
  expect(document.getCreator()).toBe('Sigil');
  expect(document.getProducer()).toBe('Sigil');
  expect(
    document.context
      .lookup(document.context.trailerInfo.Info, PDFDict)
      .keys()
      .map((key) => key.asString())
      .sort(),
  ).toEqual(['/CreationDate', '/Creator', '/ModDate', '/Producer', '/Title']);
  expect(raw).not.toMatch(/pdf-lib|hopding/i);
  expect(raw.toLowerCase()).not.toContain('calme');
  expect(text.toLowerCase()).not.toContain('calme');
  await expect(page.getByRole('button', { name: 'Exporter' })).toBeFocused();
  expect(await cspViolations(page)).toEqual([]);
});

test('downloads a 4096 px PNG (F5 dialog)', async ({ page }, testInfo) => {
  await watchCsp(page);
  await page.goto('./');
  await trace(page);
  const dialog = await openExport(page, 'PNG');
  await dialog.getByRole('radio', { name: '4096 px' }).check({ force: true });

  const { file, path } = await download(page, testInfo);
  const png = await readFile(path);

  expect(file.suggestedFilename()).toMatch(/^sigil-kamea-\d{8}-\d{6}\.png$/);
  expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
  expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual({
    width: 4096,
    height: 4096,
  });
  expect(await cspViolations(page)).toEqual([]);
});

test('exports the stencil PDF offline, the PDF code being precached (F5, F7)', async ({
  page,
  context,
}, testInfo) => {
  await page.goto('./');
  await waitForServiceWorkerControl(page);
  await context.setOffline(true);
  await page.reload();
  await trace(page);
  await openExport(page, 'PDF');

  const { file, path } = await download(page, testInfo);

  expect(file.suggestedFilename()).toMatch(PDF_NAME);
  expect((await readFile(path)).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  await context.setOffline(false);
});
