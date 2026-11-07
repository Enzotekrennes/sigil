/**
 * End-to-end journey of feature F2 (Spare sigil) on the production build:
 * nominal trace with its explanation, another variant, determinism across
 * reloads (path data compared stroke by stroke), the "only vowels" error and
 * its direct answer, and the privacy of the intention (D8).
 */
import { expect, test, type Page } from '@playwright/test';

/** Intention of the F2 scenario. */
const INTENTION = 'Je suis calme';

/**
 * Selects Spare, types the intention and presses the "Tracer" button.
 *
 * @param page - Page on the app.
 * @param intention - Text to type.
 */
async function traceSpare(page: Page, intention: string): Promise<void> {
  // The radio itself is visually hidden: click its visible segment, as a user does.
  await page.getByText('Spare', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Spare' })).toBeChecked();
  await page.getByRole('textbox', { name: 'Intention' }).fill(intention);
  await page.getByRole('button', { name: 'Tracer' }).click();
}

/**
 * Path data of the Spare sigil shown, one entry per stroke.
 *
 * @param page - Page showing a Spare sigil.
 * @returns The `d` attribute of every path of the sigil, in tracing order.
 */
async function strokePaths(page: Page): Promise<string[]> {
  return page
    .getByRole('img', { name: /^Sigil de Spare/ })
    .locator('path')
    .evaluateAll((paths) => paths.map((path) => path.getAttribute('d') ?? ''));
}

test('traces "Je suis calme" with Spare, shows the reduction, and redraws each variant identically after a reload', async ({
  page,
}) => {
  // The screen sets custom properties through React's `style` prop: the strict CSP (D12) must allow it.
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { cspViolations: violations });
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(event.effectiveDirective);
    });
  });
  await page.goto('./');

  await traceSpare(page, INTENTION);

  const sigil = page.getByRole('img', { name: 'Sigil de Spare, variante 1' });
  await expect(sigil).toBeVisible();
  await expect(sigil.locator('[data-mark]')).toHaveCount(0);
  await expect(page.getByText('J S C L M', { exact: true })).toBeVisible();
  await expect(page.getByText('E U I A', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Les 5 lettres superposées avant fusion' }),
  ).toBeVisible();
  const first = await strokePaths(page);
  expect(first.length).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Autre variante' }).click();
  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 2' })).toBeVisible();
  await expect(page.getByText('Variante 2', { exact: true })).toBeVisible();
  const second = await strokePaths(page);
  expect(second).not.toEqual(first);
  // The init script added this property to window; the page types know nothing about it.
  expect(
    await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
  ).toEqual([]);

  await page.reload();
  await traceSpare(page, INTENTION);
  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 1' })).toBeVisible();
  expect(await strokePaths(page)).toEqual(first);
  await page.getByRole('button', { name: 'Autre variante' }).click();
  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 2' })).toBeVisible();
  expect(await strokePaths(page)).toEqual(second);
});

test('offers to keep the vowels when no consonant is left, then traces', async ({ page }) => {
  await page.goto('./');

  await traceSpare(page, 'oui');

  const field = page.getByRole('textbox', { name: 'Intention' });
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/Gardez les voyelles pour la tracer/)).toBeVisible();
  await expect(field).toBeFocused();
  await expect(page.getByRole('img', { name: /^Sigil de Spare/ })).toHaveCount(0);

  // Keyboard: from the field, the next stop is the direct answer to the error.
  await page.keyboard.press('Tab');
  const keepVowels = page.getByRole('button', { name: 'Garder les voyelles et tracer' });
  await expect(keepVowels).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 1' })).toBeVisible();
  const option = page.getByRole('switch', { name: 'Garder les voyelles' });
  await expect(option).toBeChecked();
  await expect(option).toBeFocused();
  await expect(field).toHaveAttribute('aria-invalid', 'false');
});

test('keeps the intention out of the URL, the storage and the Spare sigil markup (D8)', async ({
  page,
}) => {
  await page.goto('./');
  const before = page.url();

  await traceSpare(page, INTENTION);
  await page.getByRole('button', { name: 'Autre variante' }).click();
  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 2' })).toBeVisible();

  expect(page.url()).toBe(before);
  const stored = await page.evaluate(() =>
    [localStorage, sessionStorage]
      .flatMap((storage) =>
        Array.from({ length: storage.length }, (_, index) => {
          const key = storage.key(index) ?? '';
          return `${key}=${storage.getItem(key) ?? ''}`;
        }),
      )
      .join(';')
      .toLowerCase(),
  );
  expect(stored).not.toContain('calme');
  const markup = await page
    .getByRole('img', { name: /^Sigil de Spare/ })
    .evaluate((svg) => svg.outerHTML.toLowerCase());
  expect(markup).not.toContain('calme');
});
