/**
 * End-to-end journey of feature F3 (animated tracing and style settings) on
 * the production build: the tracing order, style changes that redraw without
 * replaying or changing the shape, the framing circle that holds the drawing,
 * replay, the step-by-step replay under reduced motion, the 375 px layout,
 * keyboard use and the strict CSP (D12).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

/** Intention of the F1 scenario, traced on Saturn by default. */
const INTENTION = 'Je suis calme';

/**
 * Types the intention and presses the "Tracer" button.
 *
 * @param page - Page on the app.
 * @param intention - Text to type.
 */
async function trace(page: Page, intention = INTENTION): Promise<void> {
  await page.getByLabel('Intention').fill(intention);
  await page.getByRole('button', { name: 'Tracer' }).click();
}

/**
 * The kamea sigil shown.
 *
 * @param page - Page showing a sigil.
 * @returns Its locator.
 */
function sigil(page: Page): Locator {
  return page.getByRole('img', { name: /^Sigil kamea/ });
}

/**
 * Run key of the tracing animation shown: it changes only when the tracing restarts.
 *
 * @param page - Page showing a sigil.
 * @returns The `data-run` attribute of the sigil's ink group.
 */
async function runKey(page: Page): Promise<string | null> {
  return sigil(page).locator('[data-run]').getAttribute('data-run');
}

/**
 * Moves the stroke width slider to the given value, as a pointer drag would.
 *
 * @param page - Page with the style section open.
 * @param value - Width in frame units.
 */
async function setStrokeWidth(page: Page, value: number): Promise<void> {
  await page.getByRole('slider', { name: 'Épaisseur' }).fill(String(value));
}

/**
 * Converts a CSS duration to milliseconds, whichever unit the stylesheet uses.
 *
 * @param duration - A CSS `<time>` such as `2400ms` or `2.4s`.
 * @returns The duration in milliseconds, rounded to the unit.
 * @throws {Error} When the value is not a CSS duration in `ms` or `s`.
 */
function toMilliseconds(duration: string): number {
  const match = /^(-?[\d.]+)(ms|s)$/.exec(duration);
  if (match === null) throw new Error(`Not a CSS duration: "${duration}"`);
  const value = Number(match[1]);
  return Math.round(match[2] === 's' ? value * 1000 : value);
}

test('traces the path first, then shows the end mark (F3)', async ({ page }) => {
  await page.goto('./');
  await trace(page);

  const path = sigil(page).locator('path.sigil-renderer__stroke');
  const endBar = sigil(page).locator('[data-mark="end-bar"]');
  await expect(sigil(page)).toHaveClass(/sigil-renderer--trace/);
  // Midway, the path is partly drawn and the end bar not shown yet.
  await page.waitForTimeout(1200);
  const midway = await path.evaluate((element) =>
    Number(getComputedStyle(element).strokeDashoffset.replace('px', '')),
  );
  expect(midway).toBeGreaterThan(0);
  expect(midway).toBeLessThan(1);
  expect(await endBar.evaluate((element) => Number(getComputedStyle(element).opacity))).toBe(0);
  // At the end, the path is whole and the mark shown.
  await expect
    .poll(() => endBar.evaluate((element) => Number(getComputedStyle(element).opacity)))
    .toBe(1);
});

test('redraws the style settings at once, without replaying nor changing the shape (F3)', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { cspViolations: violations });
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(event.effectiveDirective);
    });
  });
  await page.goto('./');
  await trace(page);
  const run = await runKey(page);
  const ink = sigil(page).locator('[data-run]');
  const path = sigil(page).locator('path.sigil-renderer__stroke');
  const shape = await path.getAttribute('d');

  await expect(page.getByRole('slider', { name: 'Épaisseur' })).toHaveAttribute(
    'aria-valuetext',
    '1,2, fin',
  );
  await setStrokeWidth(page, 2.4);
  await expect(ink).toHaveAttribute('stroke-width', '2.4');
  await expect(page.getByText('épais · 2,4')).toBeVisible();

  await page.getByRole('switch', { name: 'Extrémités arrondies' }).click({ force: true });
  await expect(ink).toHaveAttribute('stroke-linecap', 'butt');
  await expect(ink).toHaveAttribute('stroke-linejoin', 'miter');
  expect(await path.getAttribute('d')).toBe(shape);

  await page.getByRole('switch', { name: 'Cercle d’encadrement' }).click({ force: true });
  const frame = sigil(page).locator('.sigil-renderer__frame');
  await expect(frame).toHaveCount(1);
  // Turned on after the tracing, the circle shows at once.
  await expect
    .poll(() => frame.evaluate((element) => getComputedStyle(element).visibility))
    .toBe('visible');

  expect(await runKey(page)).toBe(run);
  expect(
    await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
  ).toEqual([]);
});

test('keeps the drawing inside the framing circle with a visible gap', async ({ page }) => {
  await page.goto('./');
  // On the Moon, E (5) sits in the top-right corner cell, beyond the circle.
  await page.getByRole('radio', { name: 'Lune 9×9' }).check({ force: true });
  await trace(page, 'Ae');
  await page.getByRole('switch', { name: 'Cercle d’encadrement' }).click({ force: true });

  const reach = await sigil(page)
    .locator('path.sigil-renderer__stroke')
    .evaluate((element) => {
      const path = element as SVGPathElement;
      const length = path.getTotalLength();
      let farthest = 0;
      for (let index = 0; index <= 100; index += 1) {
        const point = path.getPointAtLength((length * index) / 100);
        farthest = Math.max(farthest, Math.hypot(point.x - 50, point.y - 50));
      }
      return farthest;
    });
  // Circle radius 46, minus half its stroke, minus two strokes of gap, minus half the path stroke.
  expect(reach).toBeLessThanOrEqual(46 - 0.6 - 2.4 - 0.6 + 0.01);
});

test('serves the duration tokens the tracing cap is computed from', async ({ page }) => {
  await page.goto('./');
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return ['--duration-trace', '--duration-pen-lift', '--duration-trace-max'].map((name) =>
      style.getPropertyValue(name).trim(),
    );
  });
  // TRACE_DURATION_MS, PEN_LIFT_MS and TRACE_MAX_MS of src/features/sigil/geometry.ts;
  // the minified build may write a duration in seconds (2.4s), so compare in ms.
  expect(tokens.map(toMilliseconds)).toEqual([2400, 80, 2700]);
});

test('replays the tracing on demand (F3)', async ({ page }) => {
  await page.goto('./');
  await trace(page);
  const run = await runKey(page);

  await page.getByRole('button', { name: 'Rejouer' }).click();

  expect(await runKey(page)).not.toBe(run);
  await expect(sigil(page)).toHaveClass(/sigil-renderer--trace/);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('shows the sigil at once, then replays it step by step (F3)', async ({ page }) => {
    await page.goto('./');
    await trace(page);

    await expect(sigil(page)).toHaveClass(/sigil-renderer--static/);
    await expect(sigil(page).locator('[pathLength]')).toHaveCount(0);
    const replay = page.getByRole('button', { name: 'Rejouer' });
    await expect(replay).toHaveAccessibleDescription(/trace une étape de plus/);

    const path = sigil(page).locator('path.sigil-renderer__stroke');
    const whole = await path.getAttribute('d');
    await replay.click();
    await expect(page.getByText('Pas à pas : étape 1 sur 10.').first()).toBeVisible();
    expect((await path.getAttribute('d'))?.match(/L/g)).toHaveLength(1);
    await expect(sigil(page).locator('[data-mark="end-bar"]')).toHaveCount(0);

    for (let step = 2; step <= 10; step += 1) await replay.click();
    expect(await path.getAttribute('d')).toBe(whole);
    await expect(sigil(page).locator('[data-mark="end-bar"]')).toHaveCount(1);
  });
});

test('fits the style section at 375 px, folded under the scene', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./');
  await trace(page);

  const summary = page.locator('summary', { hasText: 'Style' });
  await expect(summary).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Épaisseur' })).toBeHidden();
  await summary.click();
  await expect(page.getByRole('slider', { name: 'Épaisseur' })).toBeVisible();

  const scene = await sigil(page).boundingBox();
  const section = await summary.boundingBox();
  expect(section?.y ?? 0).toBeGreaterThan((scene?.y ?? 0) + (scene?.height ?? 0));
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test('sets every style control with the keyboard', async ({ page }) => {
  await page.goto('./');
  await trace(page);

  const slider = page.getByRole('slider', { name: 'Épaisseur' });
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', '1,4, fin');
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuetext', '2,4, épais');
  await expect(sigil(page).locator('[data-run]')).toHaveAttribute('stroke-width', '2.4');

  await page.keyboard.press('Tab');
  const roundEnds = page.getByRole('switch', { name: 'Extrémités arrondies' });
  await expect(roundEnds).toBeFocused();
  await page.keyboard.press('Space');
  await expect(roundEnds).not.toBeChecked();

  await page.keyboard.press('Tab');
  const frame = page.getByRole('switch', { name: 'Cercle d’encadrement' });
  await expect(frame).toBeFocused();
  await page.keyboard.press('Space');
  await expect(frame).toBeChecked();
  await expect(sigil(page).locator('.sigil-renderer__frame')).toHaveCount(1);
});
