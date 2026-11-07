/**
 * Acceptance scenarios of feature F2 (Spare sigil), played on the production
 * build: reduction shown in the panel, determinism across reloads, variants,
 * frame and centre of gravity measured on the rendered path data, the
 * "only vowels" message, the vowels option resetting the variant, privacy of
 * the intention, CSP, 375 px layout and keyboard use.
 *
 * The "no letter readable on its own" criterion is a visual judgement and is
 * not asserted here: it is recorded in the tester report.
 */
import { expect, test, type Page } from '@playwright/test';

/** Intention of the reference scenario. */
const CALM = 'Je suis calme';

/** Side of the sigil square in frame units (viewBox 0 0 100 100). */
const FRAME_SIDE = 100;

/** Maximum distance between centre of gravity and frame centre, as a share of the side (F2). */
const MAX_GRAVITY_OFFSET = 0.1;

/** Drawing area of the frame: 10 units of margin on each side (`frame.ts`). */
const DRAWING_MIN = 10;
const DRAWING_MAX = 90;

/** Rounding tolerance when comparing coordinates printed with three decimals. */
const EPSILON = 0.01;

test.use({ reducedMotion: 'reduce' });

/**
 * Selects Spare, sets the vowels option, types the intention and presses "Tracer".
 *
 * @param page - Page on the app.
 * @param intention - Text to type.
 * @param keepVowels - Wanted state of the "Garder les voyelles" option.
 */
async function traceSpare(page: Page, intention: string, keepVowels = false): Promise<void> {
  await page.getByText('Spare', { exact: true }).click();
  const option = page.getByRole('switch', { name: 'Garder les voyelles' });
  if ((await option.isChecked()) !== keepVowels) {
    // The switch input is visually hidden: click its visible label.
    await page.getByText('Garder les voyelles', { exact: true }).click();
  }
  await page.getByRole('textbox', { name: 'Intention' }).fill(intention);
  await page.getByRole('button', { name: 'Tracer' }).click();
}

/**
 * Shows variant `variant` of an intention by clicking "Autre variante".
 *
 * @param page - Page showing variant 1 of a Spare sigil.
 * @param variant - Displayed variant number, from 1.
 */
async function goToVariant(page: Page, variant: number): Promise<void> {
  for (let current = 1; current < variant; current += 1) {
    await page.getByRole('button', { name: 'Autre variante' }).click();
  }
  await expect(
    page.getByRole('img', { name: `Sigil de Spare, variante ${String(variant)}` }),
  ).toBeVisible();
}

/**
 * Clicks "Autre variante" once and waits for the expected variant number.
 *
 * @param page - Page showing the previous variant.
 * @param variant - Variant number expected after the click.
 */
async function nextVariant(page: Page, variant: number): Promise<void> {
  await page.getByRole('button', { name: 'Autre variante' }).click();
  await expect(
    page.getByRole('img', { name: `Sigil de Spare, variante ${String(variant)}` }),
  ).toBeVisible();
}

/**
 * Path data of the Spare sigil shown, one entry per stroke.
 *
 * @param page - Page showing a Spare sigil.
 * @returns The `d` attributes in tracing order.
 */
async function strokePaths(page: Page): Promise<string[]> {
  return page
    .getByRole('img', { name: /^Sigil de Spare/ })
    .locator('path')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d') ?? ''));
}

/** Geometry of a rendered sigil, in frame units. */
interface Geometry {
  readonly centreX: number;
  readonly centreY: number;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * Centre of gravity (weighted by stroke length) and bounding box computed from
 * the `d` attributes of the rendered paths (absolute `M`/`L` polylines).
 *
 * @param page - Page showing a Spare sigil.
 * @returns Centre of gravity and extremes of the drawing.
 */
async function measureSigil(page: Page): Promise<Geometry> {
  let total = 0;
  let sumX = 0;
  let sumY = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const d of await strokePaths(page)) {
    // Only absolute move and line commands are expected from the Spare renderer.
    expect(d.replace(/[ML\d.\s-]/g, '')).toBe('');
    const points = [...d.matchAll(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g)].map(
      (match) => [Number(match[1]), Number(match[2])] as const,
    );
    points.forEach(([x, y], index) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const previous = points[index - 1];
      if (previous === undefined) return;
      const length = Math.hypot(x - previous[0], y - previous[1]);
      total += length;
      sumX += (length * (x + previous[0])) / 2;
      sumY += (length * (y + previous[1])) / 2;
    });
  }
  return { centreX: sumX / total, centreY: sumY / total, minX, minY, maxX, maxY };
}

test('scenario 1: shows the removed letters and the kept letters J S C L M', async ({ page }) => {
  await page.goto('./');
  await traceSpare(page, CALM);

  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 1' })).toBeVisible();
  await expect(page.getByText('S E', { exact: true })).toBeVisible(); // duplicates
  await expect(page.getByText('E U I A', { exact: true })).toBeVisible(); // vowels
  await expect(page.getByText('J S C L M', { exact: true })).toBeVisible(); // kept
});

test('scenario 2: same intention and settings give the same sigil after a reload, with or without punctuation', async ({
  page,
}) => {
  await page.goto('./');
  await traceSpare(page, CALM);
  const first = (await strokePaths(page)).join('|');
  expect(first.length).toBeGreaterThan(0);

  await page.reload();
  await traceSpare(page, CALM);
  expect((await strokePaths(page)).join('|')).toBe(first);

  // The seed comes from the kept letters, not from the raw text.
  await traceSpare(page, 'je suis calme !');
  expect((await strokePaths(page)).join('|')).toBe(first);
});

test('scenario 3: "Autre variante" gives a different sigil each time, and variant n is always the same', async ({
  page,
}) => {
  const variantCount = 5;

  /**
   * Plays variants 1 to `variantCount`.
   *
   * @returns Path data of each variant, in order.
   */
  async function playVariants(): Promise<string[]> {
    await traceSpare(page, CALM);
    const run = [(await strokePaths(page)).join('|')];
    for (let variant = 2; variant <= variantCount; variant += 1) {
      await nextVariant(page, variant);
      run.push((await strokePaths(page)).join('|'));
    }
    return run;
  }

  await page.goto('./');
  const firstRun = await playVariants();
  expect(new Set(firstRun).size).toBe(variantCount);

  await page.reload();
  expect(await playVariants()).toEqual(firstRun);
});

test('scenario 4: sigils fit the frame and their centre of gravity is within 10 % of the centre', async ({
  page,
}) => {
  const cases: readonly (readonly [string, number])[] = [
    [CALM, 5],
    ['Je trouve ma voie', 2],
    ['I am strong', 5],
    ['My mind is clear', 1],
    ['La paix est en moi', 1],
    ['Yeux', 1],
    [
      'Je choisis chaque jour la patience la clarté et la force tranquille pour avancer sereinement vers mes projets les plus chers',
      1,
    ],
  ];
  let measured = 0;
  await page.goto('./');
  for (const [intention, variantCount] of cases) {
    await traceSpare(page, intention);
    for (let variant = 1; variant <= variantCount; variant += 1) {
      if (variant > 1) await nextVariant(page, variant);
      const geometry = await measureSigil(page);
      const offset =
        Math.hypot(geometry.centreX - FRAME_SIDE / 2, geometry.centreY - FRAME_SIDE / 2) /
        FRAME_SIDE;
      expect(offset, `${intention.slice(0, 20)} v${String(variant)}`).toBeLessThan(
        MAX_GRAVITY_OFFSET,
      );
      for (const value of [geometry.minX, geometry.minY]) {
        expect(value).toBeGreaterThanOrEqual(DRAWING_MIN - EPSILON);
      }
      for (const value of [geometry.maxX, geometry.maxY]) {
        expect(value).toBeLessThanOrEqual(DRAWING_MAX + EPSILON);
      }
      measured += 1;
    }
  }
  expect(measured).toBeGreaterThanOrEqual(10);
});

test('scenario 5: an intention with no consonant left proposes to keep the vowels', async ({
  page,
}) => {
  await page.goto('./');
  await traceSpare(page, 'oui');

  await expect(page.getByText(/Gardez les voyelles pour la tracer/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Intention' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByRole('img', { name: /^Sigil de Spare/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Garder les voyelles et tracer' }).click();
  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 1' })).toBeVisible();
});

test('keeps Y as a consonant: "Yeux" retains Y and X', async ({ page }) => {
  await page.goto('./');
  await traceSpare(page, 'Yeux');
  await expect(page.getByText('Y X', { exact: true })).toBeVisible();
});

test('tracing again after changing the vowels option restarts at variant 1', async ({ page }) => {
  await page.goto('./');
  await traceSpare(page, CALM);
  await goToVariant(page, 3);

  await traceSpare(page, CALM, true);
  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 1' })).toBeVisible();
  await expect(page.getByText('J E S U I C A L M', { exact: true })).toBeVisible();
});

test('keeps the intention out of the URL, storage, caches and sigil, and breaks no CSP rule', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { cspViolations: violations });
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(event.effectiveDirective);
    });
  });
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto('./');
  const before = page.url();

  await traceSpare(page, 'Je trouve ma voie');
  await goToVariant(page, 2);

  expect(page.url()).toBe(before);
  const leaks = await page.evaluate(async () => {
    const words = ['trouve', 'voie'];
    const holders = [
      JSON.stringify(Object.entries(localStorage)),
      JSON.stringify(Object.entries(sessionStorage)),
      document.cookie,
      (await caches.keys()).join(';'),
      (await indexedDB.databases()).map((database) => database.name).join(';'),
      document.title,
      document.querySelector('svg[role="img"]')?.outerHTML ?? '',
    ].map((text) => text.toLowerCase());
    return words.filter((word) => holders.some((text) => text.includes(word)));
  });
  expect(leaks).toEqual([]);
  expect(
    await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
  ).toEqual([]);
  expect(problems).toEqual([]);
});

test('is usable at 375 px: no horizontal scroll, touch-sized controls, sigil inside the screen', async ({
  page,
}) => {
  const minTouchSide = 44;
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./');
  await traceSpare(page, CALM);
  const sigil = page.getByRole('img', { name: 'Sigil de Spare, variante 1' });
  await expect(sigil).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  const box = await sigil.boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
  for (const name of ['Tracer', 'Autre variante', 'Rejouer']) {
    const button = await page.getByRole('button', { name }).boundingBox();
    expect(button?.height).toBeGreaterThanOrEqual(minTouchSide);
  }
  await goToVariant(page, 2);
});

test('can be driven entirely with the keyboard', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Intention' })).toBeFocused();
  await page.keyboard.type(CALM);

  // Method radio group: the checked radio holds the tab stop; arrows change it.
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('radio', { name: 'Spare' })).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('switch', { name: 'Garder les voyelles' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Tracer' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 1' })).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Autre variante' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Autre variante' })).toBeFocused();
});
