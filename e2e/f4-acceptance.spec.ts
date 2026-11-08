/**
 * Acceptance scenarios of feature F4 (SVG and PNG exports), played on the
 * production build through the "Exporter" dialog (format, PNG resolution,
 * "Télécharger"): the four scenarios of the plan, plus the cases around
 * them (both methods, both kamea extremes, every style setting, both themes
 * chosen by `data-theme` or by the system, mid-animation export, double
 * click, keyboard, 375 px, odd intentions) and a search for the intention in
 * the file names, the SVG text and the PNG chunks.
 *
 * "Opens in a vector editor" is checked without one: the SVG must be a
 * strict-XML, self-contained document (no `var()`, class, style, link or
 * script, a namespace, a `viewBox`) and must look the same, pixel for pixel
 * within a small tolerance, when opened alone as when drawn on the scene.
 *
 * Files and screenshots are kept in `F4_EVIDENCE_DIR` (default
 * `test-results/f4-evidence`).
 */
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  expect,
  test,
  type BrowserContext,
  type Download,
  type Locator,
  type Page,
} from '@playwright/test';

/** Where exported files and screenshots are kept for review. */
const EVIDENCE_DIR = resolve(process.env.F4_EVIDENCE_DIR ?? 'test-results/f4-evidence');

/** Neutral file name of an export (decision D8). */
const FILE_NAME = /^sigil-(kamea|spare)-\d{8}-\d{6}\.(svg|png)$/;

/** Side of the exported PNG, in pixels. */
const PNG_SIZE = 2048;

/** Scene background of each theme (`--color-surface` in tokens.css), as RGB. */
const SURFACE = { light: [0xfa, 0xf7, 0xf0], dark: [0x1a, 0x18, 0x14] } as const;

/** Literal stroke colour of each theme as written in the SVG (`--sigil-stroke`). */
const INK = { light: '#1c1914', dark: '#d2ae5c' } as const;

/** Share of pixels allowed to differ between two renderings of the same drawing. */
const MAX_DIFF_RATIO = 0.003;

/** Pixels around the square ignored when comparing with the scene (its rounded corners). */
const COMPARE_MARGIN = 8;

/** Intention of the F1 scenario, one word (D18). */
const CALM = 'Calme';

/** Unusual intention: rare letters so that any leak is recognisable. */
const RARE = 'Xylophone';

/** One word with two doubled letters, so the kamea draws loops. */
const DOUBLED = 'Rassemblée';

/** Chunk types a PNG may carry textual metadata in. */
const TEXT_CHUNKS = ['tEXt', 'iTXt', 'zTXt', 'eXIf'];

test.use({ reducedMotion: 'reduce' });

/** One styled export to check. */
interface ExportCase {
  readonly id: string;
  readonly method: 'kamea' | 'spare';
  readonly planet?: string;
  readonly intention: string;
  readonly width: number;
  readonly round: boolean;
  readonly frame: boolean;
  readonly theme: 'light' | 'dark';
}

const CASES: readonly ExportCase[] = [
  {
    id: 'kamea-saturn-default',
    method: 'kamea',
    planet: 'Saturne',
    intention: CALM,
    width: 1.2,
    round: true,
    frame: false,
    theme: 'light',
  },
  {
    id: 'kamea-moon-thick-frame-dark',
    method: 'kamea',
    planet: 'Lune',
    intention: DOUBLED,
    width: 2.4,
    round: true,
    frame: true,
    theme: 'dark',
  },
  {
    id: 'kamea-saturn-thin-butt-light',
    method: 'kamea',
    planet: 'Saturne',
    intention: CALM,
    width: 0.4,
    round: false,
    frame: false,
    theme: 'light',
  },
  {
    id: 'kamea-moon-thin-butt-frame-dark',
    method: 'kamea',
    planet: 'Lune',
    intention: DOUBLED,
    width: 0.4,
    round: false,
    frame: true,
    theme: 'dark',
  },
  {
    id: 'kamea-moon-thick-butt-light',
    method: 'kamea',
    planet: 'Lune',
    intention: DOUBLED,
    width: 2.4,
    round: false,
    frame: false,
    theme: 'light',
  },
  {
    id: 'spare-default-light',
    method: 'spare',
    intention: CALM,
    width: 1.2,
    round: true,
    frame: false,
    theme: 'light',
  },
  {
    id: 'spare-thick-frame-dark',
    method: 'spare',
    intention: CALM,
    width: 2.4,
    round: true,
    frame: true,
    theme: 'dark',
  },
  {
    id: 'spare-thin-butt-dark',
    method: 'spare',
    intention: RARE,
    width: 0.4,
    round: false,
    frame: false,
    theme: 'dark',
  },
  {
    id: 'spare-thick-butt-frame-light',
    method: 'spare',
    intention: RARE,
    width: 2.4,
    round: false,
    frame: true,
    theme: 'light',
  },
];

/** What a page reported that should be empty at the end of a test. */
interface PageWatch {
  readonly csp: () => Promise<string[]>;
  readonly problems: string[];
  readonly requests: string[];
}

/**
 * Starts collecting CSP violations, console errors, page errors and
 * non-local network requests before any script of the page runs.
 *
 * @param page - Page not yet navigated.
 * @returns Accessors on what was collected.
 */
async function watch(page: Page): Promise<PageWatch> {
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { cspViolations: violations });
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
  const problems: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('request', (request) => {
    const url = request.url();
    if (!/^(blob:|data:)/.test(url) && !url.startsWith('http://localhost:')) requests.push(url);
  });
  return {
    csp: () =>
      page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
    problems,
    requests,
  };
}

/**
 * Asserts nothing was reported by `watch`.
 *
 * @param seen - What `watch` collected.
 */
async function expectClean(seen: PageWatch): Promise<void> {
  expect(await seen.csp()).toEqual([]);
  expect(seen.problems).toEqual([]);
  expect(seen.requests).toEqual([]);
}

/**
 * Selects a method (and planet), types the intention and presses "Tracer".
 *
 * @param page - Page on the app.
 * @param intention - Text to type.
 * @param method - Method to select.
 * @param planet - French planet name, for kamea.
 */
async function trace(
  page: Page,
  intention: string,
  method: 'kamea' | 'spare' = 'kamea',
  planet?: string,
): Promise<void> {
  await page.getByRole('textbox', { name: 'Intention' }).fill(intention);
  if (method === 'spare') await page.getByRole('radio', { name: 'Spare' }).check({ force: true });
  if (planet !== undefined) {
    await page.getByRole('radio', { name: new RegExp(`^${planet}`) }).check({ force: true });
  }
  await page.getByRole('button', { name: 'Tracer' }).click();
  await expect(sigilOf(page)).toBeVisible();
}

/**
 * The sigil shown on the scene.
 *
 * @param page - Page showing a sigil.
 * @returns Its locator.
 */
function sigilOf(page: Page): Locator {
  return page.getByRole('img', { name: /^Sigil (kamea|de Spare)/ });
}

/**
 * Applies the style settings of a case.
 *
 * @param page - Page showing a sigil.
 * @param style - Width, line ends and framing circle wanted.
 * @param style.width - Stroke width in frame units.
 * @param style.round - Rounded line ends wanted.
 * @param style.frame - Framing circle wanted.
 */
async function setStyle(
  page: Page,
  style: { width: number; round: boolean; frame: boolean },
): Promise<void> {
  await page.getByRole('slider', { name: 'Épaisseur' }).fill(String(style.width));
  const wants: [string, boolean][] = [
    ['Extrémités arrondies', style.round],
    ['Cercle d’encadrement', style.frame],
  ];
  for (const [name, wanted] of wants) {
    const toggle = page.getByRole('switch', { name });
    if ((await toggle.isChecked()) !== wanted) await toggle.click({ force: true });
    if (wanted) await expect(toggle).toBeChecked();
    else await expect(toggle).not.toBeChecked();
  }
}

/**
 * Waits until no animation of the page is running.
 *
 * @param page - Page showing a sigil.
 */
async function settled(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => document.getAnimations().every((a) => a.playState === 'finished')),
    )
    .toBe(true);
}

/**
 * The button of the scene that opens the export dialog.
 *
 * @param page - Page on the app.
 * @returns Its locator.
 */
function openButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Exporter', exact: true });
}

/**
 * The export dialog.
 *
 * @param page - Page on the app.
 * @returns Its locator.
 */
function exportDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Exporter le sigil' });
}

/**
 * Opens the export dialog and picks a format (and a PNG side).
 *
 * @param page - Page showing a sigil.
 * @param format - Label of the format.
 * @param side - PNG side in pixels, when the format is PNG.
 * @returns The dialog.
 */
async function openExport(
  page: Page,
  format: 'SVG' | 'PNG',
  side: 1024 | 2048 | 4096 = PNG_SIZE,
): Promise<Locator> {
  await openButton(page).click();
  const dialog = exportDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: format, exact: true }).check({ force: true });
  if (format === 'PNG') {
    await dialog.getByRole('radio', { name: `${String(side)} px` }).check({ force: true });
  }
  return dialog;
}

/**
 * Waits until the export dialog is closed for the app, not only for the eye.
 *
 * Escape closes the native `<dialog>` at once, but the app learns it from the
 * `close` event a task later and only then unmounts the dialog's content. A
 * key pressed in between (a test is faster than a person) would reach the
 * button while the app still believes the dialog is open and be lost, so the
 * test waits for the content to be gone.
 *
 * @param page - Page on the app.
 */
async function expectClosed(page: Page): Promise<void> {
  await expect(exportDialog(page)).toBeHidden();
  await expect(page.locator('dialog.dialog .dialog__body')).toHaveCount(0);
}

/**
 * Exports through the dialog and waits for the file, keeping a copy as evidence.
 *
 * @param page - Page showing a sigil.
 * @param format - Label of the format.
 * @param id - Evidence file stem.
 * @param side - PNG side in pixels.
 * @returns The suggested name and the saved path.
 */
async function exportAs(
  page: Page,
  format: 'SVG' | 'PNG',
  id: string,
  side: 1024 | 2048 | 4096 = PNG_SIZE,
): Promise<{ name: string; path: string }> {
  const dialog = await openExport(page, format, side);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Télécharger' }).click(),
  ]);
  const kept = await keep(download, id);
  await expect(dialog).toBeHidden();
  return kept;
}

/**
 * Saves a download in the evidence folder and logs its suggested name.
 *
 * @param download - Finished download.
 * @param id - Evidence file stem.
 * @returns The suggested name and the saved path.
 */
async function keep(download: Download, id: string): Promise<{ name: string; path: string }> {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const name = download.suggestedFilename();
  const path = join(EVIDENCE_DIR, `${id}${name.slice(name.lastIndexOf('.'))}`);
  await download.saveAs(path);
  await appendFile(join(EVIDENCE_DIR, 'names.log'), `${id}\t${name}\n`);
  return { name, path };
}

/** Result of reading a PNG header and chunk list. */
interface PngInfo {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: number;
  readonly colorType: number;
  readonly chunks: string[];
}

/**
 * Reads the size and the chunk types of a PNG.
 *
 * @param png - PNG file content.
 * @returns Header fields and every chunk type in order.
 */
function pngInfo(png: Buffer): PngInfo {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const chunks: string[] = [];
  let offset = 8;
  while (offset < png.length) {
    chunks.push(png.subarray(offset + 4, offset + 8).toString('ascii'));
    offset += 12 + png.readUInt32BE(offset);
  }
  expect(offset).toBe(png.length);
  expect(chunks[0]).toBe('IHDR');
  expect(chunks.at(-1)).toBe('IEND');
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
    bitDepth: png[24] ?? 0,
    colorType: png[25] ?? 0,
    chunks,
  };
}

/**
 * Opens a blank page of the same context, used to decode and compare images
 * (no CSP applies to it).
 *
 * @param context - Browser context of the test.
 * @returns The blank page.
 */
async function toolPage(context: BrowserContext): Promise<Page> {
  const tool = await context.newPage();
  await tool.goto('about:blank');
  return tool;
}

/** Outcome of comparing two images. */
interface Diff {
  /** Share of compared pixels whose colour differs noticeably. */
  readonly ratio: number;
  /** Pixels that are not the corner colour in the second image. */
  readonly inked: number;
}

/**
 * Compares two PNGs pixel by pixel after scaling the first to the size of the
 * second; a pixel differs when any channel is off by more than 64/255.
 *
 * @param tool - Blank page.
 * @param first - PNG scaled to the second one.
 * @param second - Reference PNG.
 * @returns The share of differing pixels and the ink of the reference.
 */
async function compare(tool: Page, first: Buffer, second: Buffer): Promise<Diff> {
  return tool.evaluate(
    async ({ a, b, margin }) => {
      /**
       * Decodes a base64 PNG into a canvas of a given size.
       *
       * @param base64 - PNG content.
       * @param size - Wanted side, or 0 for the natural size.
       * @returns The pixels.
       */
      async function pixels(base64: string, size: number): Promise<ImageData> {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const side = size === 0 ? image.naturalWidth : size;
        const canvas = document.createElement('canvas');
        canvas.width = side;
        canvas.height = side;
        const context = canvas.getContext('2d');
        if (context === null) throw new Error('No 2D context');
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, side, side);
        return context.getImageData(0, 0, side, side);
      }
      const reference = await pixels(b, 0);
      const other = await pixels(a, reference.width);
      const scaledMargin = Math.round((margin * reference.width) / 640);
      let differing = 0;
      let total = 0;
      let inked = 0;
      for (let y = scaledMargin; y < reference.height - scaledMargin; y += 1) {
        for (let x = scaledMargin; x < reference.width - scaledMargin; x += 1) {
          const i = (y * reference.width + x) * 4;
          total += 1;
          const off = [0, 1, 2].some(
            (c) => Math.abs((reference.data[i + c] ?? 0) - (other.data[i + c] ?? 0)) > 64,
          );
          if (off) differing += 1;
          if (
            reference.data[i] !== reference.data[0] ||
            reference.data[i + 1] !== reference.data[1]
          ) {
            inked += 1;
          }
        }
      }
      return { ratio: differing / total, inked };
    },
    { a: first.toString('base64'), b: second.toString('base64'), margin: COMPARE_MARGIN },
  );
}

/**
 * Draws an SVG file alone on a page of the given size, as an `<img>` of a
 * local HTML wrapper, and photographs the page.
 *
 * @param context - Browser context of the test.
 * @param svgPath - Saved SVG file.
 * @param side - Pixel side of the page and of the image.
 * @param colorScheme - System colour scheme of the viewer.
 * @returns PNG screenshot of the rendering.
 */
async function renderSvgAlone(
  context: BrowserContext,
  svgPath: string,
  side: number,
  colorScheme: 'light' | 'dark' = 'light',
): Promise<Buffer> {
  const wrapper = `${svgPath}.view.html`;
  await writeFile(
    wrapper,
    `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f0f"><img src="${basename(svgPath)}" width="${String(side)}" height="${String(side)}" style="display:block">`,
  );
  const viewer = await context.newPage();
  await viewer.setViewportSize({ width: side, height: side });
  await viewer.emulateMedia({ colorScheme });
  await viewer.goto(pathToFileURL(wrapper).href);
  await viewer.locator('img').evaluate((img: HTMLImageElement) => img.decode());
  const shot = await viewer.screenshot();
  await viewer.close();
  return shot;
}

/** Structure of an SVG document as parsed by the browser. */
interface SvgFacts {
  readonly parseError: string | null;
  readonly root: string;
  readonly namespace: string | null;
  readonly attributes: Record<string, string>;
  readonly elements: string[];
  readonly unknownAttributes: string[];
  readonly texts: string[];
  readonly paints: string[];
}

/** Attributes each element of an export may carry. */
const ALLOWED_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  svg: ['xmlns', 'width', 'height', 'viewBox'],
  title: [],
  rect: ['x', 'y', 'width', 'height', 'fill'],
  g: ['fill', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit'],
  path: ['d', 'stroke'],
  circle: ['cx', 'cy', 'r', 'stroke'],
  line: ['x1', 'y1', 'x2', 'y2', 'stroke'],
};

/**
 * Parses an SVG file with the browser's strict XML parser.
 *
 * @param tool - Blank page.
 * @param markup - File content.
 * @returns What the parser found.
 */
async function parseSvg(tool: Page, markup: string): Promise<SvgFacts> {
  return tool.evaluate(
    ({ text, allowed }) => {
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      const error = doc.querySelector('parsererror');
      const root = doc.documentElement;
      const all = Array.from(root.querySelectorAll('*'));
      const unknown: string[] = [];
      const paints: string[] = [];
      for (const element of [root, ...all]) {
        const known = allowed[element.localName];
        if (known === undefined) unknown.push(`<${element.localName}>`);
        for (const attribute of Array.from(element.attributes)) {
          if (known !== undefined && !known.includes(attribute.name)) {
            unknown.push(`${element.localName}@${attribute.name}`);
          }
          if (['fill', 'stroke'].includes(attribute.name)) paints.push(attribute.value);
        }
      }
      return {
        parseError: error === null ? null : error.textContent,
        root: root.localName,
        namespace: root.namespaceURI,
        attributes: Object.fromEntries(Array.from(root.attributes).map((a) => [a.name, a.value])),
        elements: all.map((element) => element.localName),
        unknownAttributes: unknown,
        texts: all
          .filter((e) => e.children.length === 0 && e.textContent !== '')
          .map((e) => e.textContent),
        paints,
      };
    },
    { text: markup, allowed: ALLOWED_ATTRIBUTES },
  );
}

/**
 * Asserts an SVG export is a self-contained, conforming document.
 *
 * @param tool - Blank page used as XML parser.
 * @param markup - File content.
 */
async function expectStandalone(tool: Page, markup: string): Promise<void> {
  expect(markup.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  const facts = await parseSvg(tool, markup);
  expect(facts.parseError).toBeNull();
  expect(facts.root).toBe('svg');
  expect(facts.namespace).toBe('http://www.w3.org/2000/svg');
  expect(facts.attributes.viewBox).toBe('0 0 100 100');
  expect(facts.attributes.width).toBe(facts.attributes.height);
  expect(Number(facts.attributes.width)).toBeGreaterThan(0);
  // Nothing outside the small vocabulary of the export: no style, script, link, class, id.
  expect(facts.unknownAttributes).toEqual([]);
  expect(facts.texts).toEqual(['Sigil']);
  expect(facts.paints.every((paint) => /^(#[0-9a-f]{6}|none)$/i.test(paint))).toBe(true);
  for (const forbidden of [
    'var(',
    'url(',
    '@import',
    '<style',
    '<script',
    'href',
    'currentColor',
    'inherit',
    'class=',
    'style=',
    'id=',
    'data-',
    'pathLength',
    'foreignObject',
    '<!DOCTYPE',
    '<!ENTITY',
  ]) {
    expect(markup, `forbidden "${forbidden}"`).not.toContain(forbidden);
  }
}

/**
 * Forms of an intention that must be found nowhere in an export.
 *
 * @param intention - Text typed by the user.
 * @returns Lower-case needles: the text, its letters without separators and
 *   accents, and its URL and base64 forms.
 */
function needles(intention: string): string[] {
  const letters = intention
    .normalize('NFD')
    .replace(/[^A-Za-z]/g, '')
    .toLowerCase();
  // Two or three letters are too short to be told apart from markup.
  return [
    intention.toLowerCase(),
    letters,
    encodeURIComponent(intention).toLowerCase(),
    Buffer.from(intention).toString('base64').toLowerCase(),
    ...intention
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 4),
  ].filter((needle) => needle.length >= 4);
}

/**
 * Asserts an export (name, text content or bytes) carries no form of the intention.
 *
 * @param intention - Text typed by the user.
 * @param name - Suggested file name.
 * @param content - File bytes.
 */
function expectNoIntention(intention: string, name: string, content: Buffer): void {
  const haystacks = [
    name.toLowerCase(),
    content.toString('latin1').toLowerCase(),
    content.toString('utf8').toLowerCase(),
    content.toString('utf16le').toLowerCase(),
  ];
  for (const needle of needles(intention)) {
    for (const haystack of haystacks) expect(haystack).not.toContain(needle);
  }
}

/**
 * Decodes a PNG in a blank page and samples the corners and the alpha channel.
 *
 * @param tool - Blank page.
 * @param png - PNG file content.
 * @returns Corner colours, lowest alpha and how many pixels differ from the top-left one.
 */
async function samplePng(
  tool: Page,
  png: Buffer,
): Promise<{ corners: number[][]; minAlpha: number; inked: number }> {
  return tool.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('No 2D context');
    context.drawImage(image, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    const at = (x: number, y: number): number[] => {
      const i = (y * width + x) * 4;
      return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
    };
    let minAlpha = 255;
    let inked = 0;
    for (let i = 0; i < data.length; i += 4) {
      minAlpha = Math.min(minAlpha, data[i + 3] ?? 0);
      if (data[i] !== data[0] || data[i + 1] !== data[1]) inked += 1;
    }
    return {
      corners: [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)],
      minAlpha,
      inked,
    };
  }, png.toString('base64'));
}

/**
 * Screenshot of the sigil as drawn on the scene.
 *
 * @param page - Page showing a settled sigil.
 * @returns The PNG and its side in pixels.
 */
async function sceneShot(page: Page): Promise<{ png: Buffer; side: number }> {
  const png = await sigilOf(page).screenshot();
  const { width, height } = pngInfo(png);
  expect(width).toBe(height);
  return { png, side: width };
}

/**
 * Starts a test on a fresh page with the colour scheme of a theme.
 *
 * @param page - Page of the test.
 * @param theme - System colour scheme.
 * @returns What the page reports.
 */
async function open(page: Page, theme: 'light' | 'dark' = 'light'): Promise<PageWatch> {
  await page.emulateMedia({ colorScheme: theme });
  const seen = await watch(page);
  await page.goto('./');
  return seen;
}

for (const item of CASES) {
  test.describe(item.id, () => {
    test('SVG export: standalone, same render as the scene, styled, no intention (scenarios 1 and 3)', async ({
      page,
      context,
    }) => {
      const seen = await open(page, item.theme);
      await trace(page, item.intention, item.method, item.planet);
      await setStyle(page, item);
      await settled(page);
      const scene = await sceneShot(page);

      const { name, path } = await exportAs(page, 'SVG', item.id);
      expect(name).toMatch(FILE_NAME);
      expect(name).toMatch(new RegExp(`^sigil-${item.method}-`));
      const bytes = await readFile(path);
      const markup = bytes.toString('utf8');
      const tool = await toolPage(context);

      await expectStandalone(tool, markup);
      expectNoIntention(item.intention, name, bytes);

      // The chosen style, as attributes of the export.
      const group = /<g ([^>]*)>/.exec(markup)?.[1] ?? '';
      expect(group).toContain(`stroke-width="${String(item.width)}"`);
      expect(group).toContain(`stroke-linecap="${item.round ? 'round' : 'butt'}"`);
      expect(group).toContain(`stroke-linejoin="${item.round ? 'round' : 'miter'}"`);
      expect(group.includes('stroke-miterlimit')).toBe(!item.round);
      expect(markup.includes('r="46"')).toBe(item.frame);
      expect(markup).toContain(
        `fill="#${SURFACE[item.theme].map((c) => c.toString(16).padStart(2, '0')).join('')}"`,
      );
      expect(markup).toContain(`stroke="${INK[item.theme]}"`);

      // Same strokes and marks as the scene.
      const onScene = await sigilOf(page).evaluate((svg) => ({
        paths: Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d')),
        marks: svg.querySelectorAll('[data-mark]').length,
      }));
      const exported = Array.from(markup.matchAll(/<path d="([^"]*)"/g)).map((m) => m[1]);
      expect(exported).toEqual(onScene.paths);
      const exportedMarks = (markup.match(/<(line|circle) /g) ?? []).length - (item.frame ? 1 : 0);
      expect(exportedMarks).toBe(onScene.marks);

      // Looks the same when opened alone, whatever the viewer's colour scheme.
      const alone = await renderSvgAlone(context, path, scene.side);
      await writeFile(join(EVIDENCE_DIR, `${item.id}.scene.png`), scene.png);
      await writeFile(join(EVIDENCE_DIR, `${item.id}.svg.png`), alone);
      const same = await compare(tool, alone, scene.png);
      expect(same.inked).toBeGreaterThan(500);
      expect(same.ratio).toBeLessThan(MAX_DIFF_RATIO);
      const otherScheme = await renderSvgAlone(
        context,
        path,
        scene.side,
        item.theme === 'dark' ? 'light' : 'dark',
      );
      expect((await compare(tool, otherScheme, alone)).ratio).toBe(0);

      await expectClean(seen);
    });

    test('PNG export: 2048 px square, theme background, no intention (scenarios 2 and 3)', async ({
      page,
      context,
    }) => {
      const seen = await open(page, item.theme);
      await trace(page, item.intention, item.method, item.planet);
      await setStyle(page, item);
      await settled(page);
      const scene = await sceneShot(page);
      const svg = await exportAs(page, 'SVG', `${item.id}-for-png`);

      const { name, path } = await exportAs(page, 'PNG', item.id);
      expect(name).toMatch(FILE_NAME);
      expect(name).toMatch(/\.png$/);
      const png = await readFile(path);
      const info = pngInfo(png);
      expect({ width: info.width, height: info.height }).toEqual({
        width: PNG_SIZE,
        height: PNG_SIZE,
      });
      expect(info.bitDepth).toBe(8);
      // No textual metadata and no colour-management chunk that could shift the background.
      expect(info.chunks.filter((chunk) => TEXT_CHUNKS.includes(chunk))).toEqual([]);
      expect(
        info.chunks.filter((chunk) => ['iCCP', 'gAMA', 'cHRM', 'sRGB'].includes(chunk)),
      ).toEqual([]);
      expectNoIntention(item.intention, name, png);

      const tool = await toolPage(context);
      const sample = await samplePng(tool, png);
      for (const corner of sample.corners) expect(corner).toEqual([...SURFACE[item.theme]]);
      expect(sample.minAlpha).toBe(255);
      expect(sample.inked).toBeGreaterThan(3000);

      // Sharp: identical to the vector drawn natively at 2048 px, and to the scene scaled down.
      const vector = await renderSvgAlone(context, svg.path, PNG_SIZE);
      await writeFile(join(EVIDENCE_DIR, `${item.id}.png-ref-2048.png`), vector);
      expect((await compare(tool, png, vector)).ratio).toBeLessThan(MAX_DIFF_RATIO);
      expect((await compare(tool, png, scene.png)).ratio).toBeLessThan(0.01);

      await expect(openButton(page)).toBeEnabled();
      await expectClean(seen);
    });
  });
}

test('the SVG differs from the scene when the style differs (control of the pixel comparison)', async ({
  page,
  context,
}) => {
  const seen = await open(page);
  await trace(page, CALM);
  await settled(page);
  const { path } = await exportAs(page, 'SVG', 'control-default');
  await setStyle(page, { width: 2.4, round: false, frame: true });
  await settled(page);
  const scene = await sceneShot(page);
  const tool = await toolPage(context);
  const alone = await renderSvgAlone(context, path, scene.side);
  expect((await compare(tool, alone, scene.png)).ratio).toBeGreaterThan(MAX_DIFF_RATIO * 3);
  await expectClean(seen);
});

test.describe('scenario 4: no sigil, no export', () => {
  test('the export button is disabled at load, after a failed trace, after a clear and after a reload', async ({
    page,
  }) => {
    const seen = await open(page);
    const exporter = openButton(page);
    await expect(exporter).toBeDisabled();

    // A click on a disabled button opens nothing and starts nothing.
    let downloads = 0;
    page.on('download', () => (downloads += 1));
    await exporter.click({ force: true });
    // Proving that nothing happens takes a quiet window: no event marks its end.
    await page.waitForTimeout(600);
    await expect(exportDialog(page)).toBeHidden();
    expect(downloads).toBe(0);
    // The keyboard skips it.
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.textContent)).not.toBe('Exporter');
    }

    await trace(page, CALM);
    await expect(exporter).toBeEnabled();

    // A trace without letters removes the sigil: nothing to export.
    await page.getByRole('textbox', { name: 'Intention' }).fill('123 !!');
    await page.getByRole('button', { name: 'Tracer' }).click();
    await expect(sigilOf(page)).toHaveCount(0);
    await expect(exporter).toBeDisabled();

    await trace(page, CALM);
    await expect(exporter).toBeEnabled();
    await page.reload();
    await expect(sigilOf(page)).toHaveCount(0);
    await expect(exporter).toBeDisabled();
    expect(downloads).toBe(0);
    await expectClean(seen);
  });
});

test.describe('themes', () => {
  const combos = [
    { scheme: 'light', attribute: 'dark', shown: 'dark' },
    { scheme: 'dark', attribute: 'light', shown: 'light' },
    { scheme: 'dark', attribute: null, shown: 'dark' },
    { scheme: 'light', attribute: null, shown: 'light' },
  ] as const;
  for (const combo of combos) {
    test(`system ${combo.scheme}, data-theme ${String(combo.attribute)}: SVG and PNG follow the ${combo.shown} theme shown`, async ({
      page,
      context,
    }) => {
      const seen = await open(page, combo.scheme);
      if (combo.attribute !== null) {
        await page.evaluate((theme) => {
          document.documentElement.setAttribute('data-theme', theme);
        }, combo.attribute);
      }
      await trace(page, CALM);
      await settled(page);
      const id = `theme-${combo.scheme}-${String(combo.attribute)}`;
      const scene = await sceneShot(page);
      const svg = await exportAs(page, 'SVG', id);
      const markup = await readFile(svg.path, 'utf8');
      expect(markup).toContain(`stroke="${INK[combo.shown]}"`);
      const background = SURFACE[combo.shown].map((c) => c.toString(16).padStart(2, '0')).join('');
      expect(markup).toContain(
        `<rect x="0" y="0" width="100" height="100" fill="#${background}"/>`,
      );
      const tool = await toolPage(context);
      const alone = await renderSvgAlone(context, svg.path, scene.side);
      expect((await compare(tool, alone, scene.png)).ratio).toBeLessThan(MAX_DIFF_RATIO);

      const png = await readFile((await exportAs(page, 'PNG', id)).path);
      expect((await samplePng(tool, png)).corners[0]).toEqual([...SURFACE[combo.shown]]);
      await expectClean(seen);
    });
  }

  test('switching the theme after tracing changes the next export, not the sigil', async ({
    page,
  }) => {
    const seen = await open(page, 'light');
    await trace(page, CALM);
    const first = await readFile((await exportAs(page, 'SVG', 'switch-before')).path, 'utf8');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    const second = await readFile((await exportAs(page, 'SVG', 'switch-after')).path, 'utf8');
    expect(first).toContain(INK.light);
    expect(second).toContain(INK.dark);
    expect(second.replaceAll(INK.dark, INK.light).replaceAll('#1a1814', '#faf7f0')).toBe(first);
    await expectClean(seen);
  });
});

test('exporting while the tracing animation plays gives the whole sigil', async ({ browser }) => {
  const context = await browser.newContext({
    reducedMotion: 'no-preference',
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const seen = await watch(page);
  await page.goto('./');
  await trace(page, CALM, 'spare');
  const early = await readFile((await exportAs(page, 'SVG', 'mid-animation')).path, 'utf8');
  await settled(page);
  const late = await readFile((await exportAs(page, 'SVG', 'after-animation')).path, 'utf8');
  expect(early).toBe(late);
  expect(early).not.toMatch(/opacity|dash/);
  await expectClean(seen);
  await context.close();
});

test('exporting during the step-by-step replay (reduced motion) gives the whole sigil', async ({
  page,
}) => {
  const seen = await open(page);
  await trace(page, CALM, 'spare');
  await settled(page);
  const whole = await readFile((await exportAs(page, 'SVG', 'stepwise-whole')).path, 'utf8');
  await page.getByRole('button', { name: 'Rejouer' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: /^Pas à pas : étape 1 sur/ }),
  ).toBeVisible();
  const midway = await readFile((await exportAs(page, 'SVG', 'stepwise-midway')).path, 'utf8');
  expect(midway).toBe(whole);
  await expectClean(seen);
});

test('a double click on "Télécharger" for PNG produces one file, no error, and the page is usable again', async ({
  page,
}) => {
  const seen = await open(page);
  await trace(page, CALM);
  await settled(page);
  const saved: Download[] = [];
  page.on('download', (download) => saved.push(download));
  const dialog = await openExport(page, 'PNG', 4096);
  await dialog.getByRole('button', { name: 'Télécharger' }).dblclick();
  await expect.poll(() => saved.length).toBeGreaterThan(0);
  await expect(dialog).toBeHidden();
  // A second file would come from the second click, rendered on its own: no
  // event marks that it will never come, so it gets a quiet window.
  await page.waitForTimeout(2500);
  expect(saved).toHaveLength(1);
  const first = saved[0];
  if (first === undefined) throw new Error('No download');
  const kept = await keep(first, 'double-click-png');
  expect(kept.name).toMatch(FILE_NAME);
  expect(pngInfo(await readFile(kept.path))).toMatchObject({ width: 4096, height: 4096 });
  await expect(dialog).toBeHidden();
  await expect(openButton(page)).toBeEnabled();
  await expect(openButton(page)).toBeFocused();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText(/échou|erreur/i)).toHaveCount(0);
  await expectClean(seen);
});

test('a double click on "Télécharger" for SVG gives one or two valid, identical files', async ({
  page,
  context,
}) => {
  const seen = await open(page);
  await trace(page, CALM, 'spare');
  await settled(page);
  const saved: Download[] = [];
  page.on('download', (download) => saved.push(download));
  const dialog = await openExport(page, 'SVG');
  await dialog.getByRole('button', { name: 'Télécharger' }).dblclick();
  await expect.poll(() => saved.length).toBeGreaterThan(0);
  // Every file the double click produces must be collected before they are
  // compared; none marks the last one, so they get a quiet window.
  await page.waitForTimeout(1500);
  expect(saved.length).toBeLessThanOrEqual(2);
  const files = await Promise.all(
    saved.map((download, index) => keep(download, `double-click-svg-${String(index)}`)),
  );
  const tool = await toolPage(context);
  const markups = await Promise.all(files.map((file) => readFile(file.path, 'utf8')));
  for (const markup of markups) await expectStandalone(tool, markup);
  expect(new Set(markups).size).toBe(1);
  for (const file of files) expect(file.name).toMatch(FILE_NAME);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expectClean(seen);
});

test('two sigils in a row give two different exports; the same sigil gives the same file', async ({
  page,
}) => {
  const seen = await open(page);
  await trace(page, CALM, 'spare');
  await settled(page);
  const a1 = await readFile((await exportAs(page, 'SVG', 'variant-1-a')).path, 'utf8');
  const a2 = await readFile((await exportAs(page, 'SVG', 'variant-1-b')).path, 'utf8');
  expect(a1).toBe(a2);
  await page.getByRole('button', { name: 'Autre variante' }).click();
  await settled(page);
  const b = await readFile((await exportAs(page, 'SVG', 'variant-2')).path, 'utf8');
  expect(b).not.toBe(a1);
  await expectClean(seen);
});

test.describe('odd intentions', () => {
  const odd = [
    // One word each (D18): the odd characters sit inside the word, without spaces.
    ['markup and quotes', '<script>alert(1)</script>&"quote"\']]><!--x-->'],
    ['accents and non-latin', 'Éléphantñandú漢字😀ß'],
    ['two letters', 'Lm'],
    ['longest word', 'Désinstitutionnalisation'],
  ] as const;
  for (const [label, intention] of odd) {
    for (const method of ['kamea', 'spare'] as const) {
      test(`${label} (${method}): valid exports, intention absent`, async ({ page, context }) => {
        const seen = await open(page);
        await trace(page, intention, method);
        await settled(page);
        const id = `odd-${label.replaceAll(' ', '-')}-${method}`;
        const svg = await exportAs(page, 'SVG', id);
        const bytes = await readFile(svg.path);
        const tool = await toolPage(context);
        await expectStandalone(tool, bytes.toString('utf8'));
        expectNoIntention(intention, svg.name, bytes);
        if (intention.length > 1) {
          // The markup of the intention never reaches the file, however it is spelt.
          expect(bytes.toString('utf8')).not.toMatch(/alert|ñandú|漢字|😀/);
        }
        const png = await exportAs(page, 'PNG', id);
        expect(pngInfo(await readFile(png.path)).width).toBe(PNG_SIZE);
        await expectClean(seen);
      });
    }
  }
});

test.describe('opened alone in a browser', () => {
  test('the SVG file loads without error, as a document of its own', async ({ page, context }) => {
    const seen = await open(page);
    await trace(page, CALM);
    await setStyle(page, { width: 2, round: true, frame: true });
    const { path } = await exportAs(page, 'SVG', 'open-alone');
    const viewer = await context.newPage();
    const errors: string[] = [];
    viewer.on('pageerror', (error) => errors.push(error.message));
    viewer.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const response = await viewer.goto(pathToFileURL(path).href);
    expect(response?.ok()).toBe(true);
    const facts = await viewer.evaluate(() => {
      const root = document.documentElement;
      const stroke = root.querySelector('path');
      return {
        contentType: document.contentType,
        root: root.localName,
        title: document.title,
        stroke: stroke === null ? '' : getComputedStyle(stroke).stroke,
        width: getComputedStyle(root.querySelector('g') as Element).strokeWidth,
        length: stroke instanceof SVGPathElement ? stroke.getTotalLength() : 0,
      };
    });
    await viewer.screenshot({ path: join(EVIDENCE_DIR, 'open-alone.page.png') });
    expect(errors).toEqual([]);
    expect(facts).toMatchObject({
      contentType: 'image/svg+xml',
      root: 'svg',
      title: 'Sigil',
      stroke: 'rgb(28, 25, 20)',
      width: '2px',
    });
    expect(facts.length).toBeGreaterThan(0);
    await expectClean(seen);
  });
});

test.describe('keyboard and small screen', () => {
  test('the dialog works with the keyboard alone and fits at 375 px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const seen = await open(page);
    await trace(page, CALM);
    await settled(page);
    const exporter = openButton(page);
    await exporter.scrollIntoViewIfNeeded();
    const box = await exporter.boundingBox();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
    // Touch targets of at least 44 px (design.md).
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );

    // Enter opens, Escape closes and gives the focus back.
    await exporter.focus();
    await expect(exporter).toBeFocused();
    await page.keyboard.press('Enter');
    const dialog = exportDialog(page);
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: join(EVIDENCE_DIR, 'mobile-375-dialog.png') });
    const frame = await dialog.boundingBox();
    expect((frame?.x ?? -1) >= 0 && (frame?.x ?? 0) + (frame?.width ?? 0) <= 375).toBe(true);
    await page.keyboard.press('Escape');
    await expectClosed(page);
    await expect(exporter).toBeFocused();

    // Choose PNG with the arrow keys, reach "Télécharger" with Tab, download with Enter.
    await expect(exporter).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('radio', { name: 'SVG', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('radio', { name: 'PNG', exact: true })).toBeChecked();
    const download = dialog.getByRole('button', { name: 'Télécharger' });
    for (let i = 0; i < 8; i += 1) {
      if (await download.evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await expect(download).toBeFocused();
    const [file] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
    const kept = await keep(file, 'keyboard-png');
    expect(kept.name).toMatch(/\.png$/);
    expect(pngInfo(await readFile(kept.path)).width).toBe(PNG_SIZE);
    await expect(dialog).toBeHidden();
    await expect(exporter).toBeFocused();
    await expectClean(seen);
  });
});

test('after a reload, a visit elsewhere and a back navigation, the page is consistent and exports stay neutral', async ({
  page,
}) => {
  const seen = await open(page);
  await trace(page, RARE);
  await exportAs(page, 'SVG', 'before-reload');
  await page.reload();
  const svg = openButton(page);
  await expect(svg).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Intention' })).toHaveValue('');
  const storage = await page.evaluate(() =>
    JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), location.href]),
  );
  expect(storage.toLowerCase()).not.toContain('xylophone');

  // Back from another page: either the page is restored whole or it starts empty,
  // but the buttons always agree with what is shown.
  await trace(page, RARE);
  await page.goto('about:blank');
  await page.goBack();
  await expect(page.getByRole('textbox', { name: 'Intention' })).toBeVisible();
  const shown = (await sigilOf(page).count()) > 0;
  if (shown) await expect(svg).toBeEnabled();
  else await expect(svg).toBeDisabled();
  if (shown) {
    const file = await readFile((await exportAs(page, 'SVG', 'after-back')).path, 'utf8');
    expect(file.toLowerCase()).not.toContain('xylophone');
  }
  await expectClean(seen);
});

/**
 * Formerly defect B1 (the PNG button was disabled while the image was built,
 * so a keyboard user lost the focus): the download button now stays focusable
 * (`aria-disabled`, `aria-busy`) and ignores clicks while the file is built.
 */
test('B1: the focus stays on "Télécharger" during a keyboard export, then returns to "Exporter"', async ({
  page,
}) => {
  const seen = await open(page);
  await trace(page, CALM);
  await settled(page);
  const dialog = await openExport(page, 'PNG', 4096);
  const download = dialog.getByRole('button', { name: 'Télécharger' });
  await download.focus();
  // Sample the button on every frame: the 4096 px image is built in a few hundred milliseconds.
  await page.evaluate(() => {
    const samples: string[] = [];
    Object.assign(window, { downloadSamples: samples });
    const watch = (): void => {
      const button = Array.from(document.querySelectorAll('dialog button')).find((candidate) =>
        candidate.textContent.includes('Télécharger'),
      );
      if (button !== undefined) {
        samples.push(
          [
            button.getAttribute('aria-busy') === 'true' ? 'busy' : 'idle',
            button === document.activeElement ? 'focused' : 'blurred',
            (button as HTMLButtonElement).disabled ? 'disabled' : 'enabled',
            button.getAttribute('aria-disabled') ?? 'none',
          ].join(' '),
        );
      }
      requestAnimationFrame(watch);
    };
    watch();
  });
  const file = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  await file;
  await expect(dialog).toBeHidden();
  const samples = await page.evaluate(
    () => (window as unknown as { downloadSamples: string[] }).downloadSamples,
  );
  const busy = samples.filter((sample) => sample.startsWith('busy'));
  // The busy state was seen, and in every frame of it the button kept the focus, was
  // never natively disabled, and announced itself as disabled.
  expect(busy.length).toBeGreaterThan(0);
  expect(new Set(busy)).toEqual(new Set(['busy focused enabled true']));
  await expect(openButton(page)).toBeFocused();
  await expectClean(seen);
});

test.describe('the export dialog', () => {
  test('offers SVG, PNG and PDF, 2048 px by default, a preview, and closes without exporting', async ({
    page,
  }) => {
    const seen = await open(page);
    await trace(page, CALM);
    let downloads = 0;
    page.on('download', () => (downloads += 1));
    const dialog = await openExport(page, 'SVG');
    for (const format of ['SVG', 'PNG', 'PDF']) {
      await expect(dialog.getByRole('radio', { name: format, exact: true })).toBeAttached();
    }
    await expect(dialog.getByRole('img', { name: 'Aperçu du fichier SVG' })).toBeVisible();
    await dialog.getByRole('radio', { name: 'PNG', exact: true }).check({ force: true });
    for (const side of [1024, 2048, 4096]) {
      await expect(dialog.getByRole('radio', { name: `${String(side)} px` })).toBeAttached();
    }
    await expect(dialog.getByRole('radio', { name: '2048 px' })).toBeChecked();
    await page.screenshot({ path: join(EVIDENCE_DIR, 'dialog-png.png') });
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(dialog).toBeHidden();
    await expect(openButton(page)).toBeFocused();
    await openButton(page).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expectClosed(page);
    // Proving that no download starts takes a quiet window: no event marks its end.
    await page.waitForTimeout(500);
    expect(downloads).toBe(0);
    await expectClean(seen);
  });

  for (const side of [1024, 4096] as const) {
    test(`PNG at ${String(side)} px: square, theme background, sharp, no metadata`, async ({
      page,
      context,
    }) => {
      const seen = await open(page, 'dark');
      await trace(page, CALM, 'spare');
      await setStyle(page, { width: 1.2, round: true, frame: true });
      await settled(page);
      const scene = await sceneShot(page);
      const { name, path } = await exportAs(page, 'PNG', `png-${String(side)}`, side);
      expect(name).toMatch(FILE_NAME);
      const png = await readFile(path);
      const info = pngInfo(png);
      expect({ width: info.width, height: info.height }).toEqual({ width: side, height: side });
      expect(info.chunks.filter((chunk) => TEXT_CHUNKS.includes(chunk))).toEqual([]);
      expectNoIntention(CALM, name, png);
      const tool = await toolPage(context);
      const sample = await samplePng(tool, png);
      for (const corner of sample.corners) expect(corner).toEqual([...SURFACE.dark]);
      expect(sample.minAlpha).toBe(255);
      expect(sample.inked).toBeGreaterThan(side * 2);
      expect((await compare(tool, png, scene.png)).ratio).toBeLessThan(0.01);
      await expectClean(seen);
    });
  }
});

test.afterAll(async () => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
});
