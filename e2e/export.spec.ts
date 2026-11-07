/**
 * End-to-end journey of feature F4 (SVG and PNG exports) on the production
 * build: buttons disabled without a sigil, downloads under a neutral name,
 * an SVG that opens on its own with the style and colours shown, a square
 * 2048 px PNG on the theme background, no trace of the intention, and no
 * Content Security Policy violation along the way.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { expect, test, type Download, type Page, type TestInfo } from '@playwright/test';

/** Intention of the F1 scenario. */
const INTENTION = 'Je suis calme';

/** Neutral file name of an export (decision D8). */
const FILE_NAME = /^sigil-(kamea|spare)-\d{8}-\d{6}\.(svg|png)$/;

/** Side of the exported PNG, in pixels. */
const PNG_SIZE = 2048;

/** Scene background of each theme (`--color-surface` in tokens.css), as RGB. */
const SURFACE = { light: [0xfa, 0xf7, 0xf0], dark: [0x1a, 0x18, 0x14] } as const;

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
 * Clicks an export button and waits for the file.
 *
 * @param page - Page showing a sigil.
 * @param format - Label of the button, `SVG` or `PNG`.
 * @returns The download.
 */
async function exportAs(page: Page, format: 'SVG' | 'PNG'): Promise<Download> {
  const exports = page.getByRole('group', { name: 'Exporter' });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exports.getByRole('button', { name: format }).click(),
  ]);
  return download;
}

/**
 * Saves a download under its suggested name, so the extension is kept.
 *
 * @param download - Finished download.
 * @param testInfo - Current test, for its output folder.
 * @returns The saved file's path.
 */
async function save(download: Download, testInfo: TestInfo): Promise<string> {
  const path = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  return path;
}

/**
 * Reads the size written in a PNG header (IHDR chunk).
 *
 * @param png - PNG file content.
 * @returns Width and height in pixels.
 */
function pngSize(png: Buffer): { width: number; height: number } {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/**
 * Decodes a PNG in the page and samples it.
 *
 * @param page - Any page of the app (its CSP allows `data:` images).
 * @param png - PNG file content.
 * @returns The RGB of the top-left pixel and how many pixels differ from it.
 */
async function samplePng(page: Page, png: Buffer): Promise<{ corner: number[]; inked: number }> {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('No 2D context');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const corner = [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0];
    let inked = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] !== corner[0] || data[index + 1] !== corner[1]) inked += 1;
    }
    return { corner, inked };
  }, png.toString('base64'));
}

test('the export buttons are disabled until a sigil is shown (F4)', async ({ page }) => {
  await page.goto('./');
  const exports = page.getByRole('group', { name: 'Exporter' });

  await expect(exports.getByRole('button', { name: 'SVG' })).toBeDisabled();
  await expect(exports.getByRole('button', { name: 'PNG' })).toBeDisabled();

  await trace(page);
  await expect(exports.getByRole('button', { name: 'SVG' })).toBeEnabled();
  await expect(exports.getByRole('button', { name: 'PNG' })).toBeEnabled();
});

test('exports an SVG that opens on its own with the style shown, without the intention (F4)', async ({
  page,
  context,
}, testInfo) => {
  await watchCsp(page);
  await page.goto('./');
  await trace(page);
  await page.getByRole('switch', { name: 'Cercle d’encadrement' }).click({ force: true });
  await page.getByRole('slider', { name: 'Épaisseur' }).fill('2');

  const download = await exportAs(page, 'SVG');
  expect(download.suggestedFilename()).toMatch(FILE_NAME);
  expect(download.suggestedFilename()).toMatch(/^sigil-kamea-/);
  const path = await save(download, testInfo);
  const markup = await readFile(path, 'utf8');

  expect(markup.toLowerCase()).not.toContain('calme');
  expect(markup).not.toContain('var(');
  expect(markup).not.toMatch(/\s(class|style|pathLength)=/);
  expect(markup).toContain('stroke-width="2"');
  // Same path as on screen, fitted inside the framing circle.
  const shown = await page
    .getByRole('img', { name: /^Sigil kamea/ })
    .locator('path')
    .getAttribute('d');
  expect(markup).toContain(`d="${shown ?? ''}"`);
  expect(markup).toContain('r="46"');

  const viewer = await context.newPage();
  const errors: string[] = [];
  viewer.on('pageerror', (error) => errors.push(error.message));
  viewer.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await viewer.goto(pathToFileURL(path).href);
  const drawn = await viewer.evaluate(() => {
    const root = document.documentElement;
    const path = root.querySelector<SVGPathElement>('path');
    return {
      root: root.localName,
      title: document.title,
      pathLength: path?.getTotalLength() ?? 0,
      stroke: path === null ? '' : getComputedStyle(path).stroke,
    };
  });
  expect(errors).toEqual([]);
  expect(drawn.root).toBe('svg');
  expect(drawn.title).toBe('Sigil');
  expect(drawn.pathLength).toBeGreaterThan(0);
  expect(drawn.stroke).toBe('rgb(28, 25, 20)');

  expect(await cspViolations(page)).toEqual([]);
});

test('exports a Spare SVG with one path per stroke shown (F4)', async ({ page }, testInfo) => {
  await page.goto('./');
  await page.getByRole('radio', { name: 'Spare' }).check({ force: true });
  await trace(page);
  const sigil = page.getByRole('img', { name: /^Sigil de Spare/ });
  // Counted once the sigil is shown: `count()` does not wait for it.
  await expect(sigil).toBeVisible();
  const strokes = await sigil.locator('path').count();

  const download = await exportAs(page, 'SVG');
  expect(download.suggestedFilename()).toMatch(/^sigil-spare-\d{8}-\d{6}\.svg$/);
  const markup = await readFile(await save(download, testInfo), 'utf8');

  expect(markup.match(/<path /g)).toHaveLength(strokes);
  expect(markup.toLowerCase()).not.toContain('calme');
});

for (const theme of ['light', 'dark'] as const) {
  test(`exports a sharp 2048 px PNG on the ${theme} theme background (F4)`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme });
    await watchCsp(page);
    await page.goto('./');
    await trace(page);

    const download = await exportAs(page, 'PNG');
    expect(download.suggestedFilename()).toMatch(FILE_NAME);
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const png = await readFile(await save(download, testInfo));

    expect(pngSize(png)).toEqual({ width: PNG_SIZE, height: PNG_SIZE });
    const { corner, inked } = await samplePng(page, png);
    expect(corner).toEqual([...SURFACE[theme]]);
    // The sigil is drawn: a fine line covers well over a thousand pixels at 2048 px.
    expect(inked).toBeGreaterThan(1000);
    await expect(
      page.getByRole('group', { name: 'Exporter' }).getByRole('button', { name: 'PNG' }),
    ).toBeEnabled();
    expect(await cspViolations(page)).toEqual([]);
  });
}
