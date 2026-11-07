/**
 * End-to-end journey of feature F1 (kamea sigil) on the production build:
 * nominal trace with its explanation, determinism across reloads, business
 * errors, keyboard-only use, and the privacy of the intention (D8).
 */
import { expect, test, type Page } from '@playwright/test';

/** Intention of the F1 scenario. */
const INTENTION = 'Je suis calme';

/**
 * Types the intention and presses the "Tracer" button.
 *
 * @param page - Page on the app.
 * @param intention - Text to type.
 */
async function trace(page: Page, intention: string): Promise<void> {
  await page.getByLabel('Intention').fill(intention);
  await page.getByRole('button', { name: 'Tracer' }).click();
}

/**
 * Markup of the traced sigil without its animation run key, which numbers the
 * sigils shown since the page loaded.
 *
 * @param page - Page showing a sigil.
 * @returns The `<svg>` outer HTML.
 */
async function sigilMarkup(page: Page): Promise<string> {
  const markup = await page
    .getByRole('img', { name: /^Sigil kamea/ })
    .evaluate((svg) => svg.outerHTML);
  return markup.replace(/data-run="[^"]*"/g, '');
}

test('traces "Je suis calme" on Saturn with its explanation, identically after a reload', async ({
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
  await expect(page.getByText(/Écrivez une intention, choisissez un carré/)).toBeVisible();

  await trace(page, INTENTION);

  const sigil = page.getByRole('img', { name: 'Sigil kamea de Saturne' });
  await expect(sigil).toBeVisible();
  await expect(sigil.locator('[data-mark="start-circle"]')).toHaveCount(1);
  await expect(sigil.locator('[data-mark="end-bar"]')).toHaveCount(1);
  await expect(page.getByText('nombre = ((rang − 1) mod 9) + 1')).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: 'Carré de Saturne, 3 × 3, avec le chemin : 1, 5, 1, 3, 9, 1, 3, 1, 3, 4, 5',
    }),
  ).toBeVisible();
  const first = await sigilMarkup(page);
  // The init script added this property to window; the page types know nothing about it.
  expect(
    await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
  ).toEqual([]);

  await page.reload();
  await trace(page, INTENTION);

  expect(await sigilMarkup(page)).toBe(first);
});

test('shows a clear error and draws nothing without a Latin letter', async ({ page }) => {
  await page.goto('./');

  await trace(page, '123 !');

  const field = page.getByLabel('Intention');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/Aucune lettre latine à tracer/)).toBeVisible();
  await expect(field).toBeFocused();
  await expect(page.getByRole('img', { name: /^Sigil kamea/ })).toHaveCount(0);

  await trace(page, '');
  await expect(page.getByText(/Écrivez une intention avant de tracer/)).toBeVisible();
  await expect(page.getByRole('img', { name: /^Sigil kamea/ })).toHaveCount(0);
});

test('works with the keyboard alone', async ({ page }) => {
  await page.goto('./');

  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Intention')).toBeFocused();
  await page.keyboard.type(INTENTION);
  // Into the method group, on its checked radio (Kamea), then the planets.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Kamea' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Saturne 3×3' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Jupiter 4×4' })).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Tracer' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('img', { name: 'Sigil kamea de Jupiter' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Rejouer' })).toBeFocused();
  // Then the two export buttons, beside replay under the scene.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'SVG' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'PNG' })).toBeFocused();
  // Then the style section, open on this wide screen, before the explanation panel.
  await page.keyboard.press('Tab');
  await expect(page.locator('summary', { hasText: 'Style' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('slider', { name: 'Épaisseur' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator('summary', { hasText: 'Comment c’est fait' })).toBeFocused();
});

test('keeps the intention out of the URL, the storage and the sigil markup (D8)', async ({
  page,
}) => {
  await page.goto('./');
  const before = page.url();

  await trace(page, INTENTION);
  await page.getByLabel('Intention').press('Enter');
  await expect(page.getByRole('img', { name: 'Sigil kamea de Saturne' })).toBeVisible();

  expect(page.url()).toBe(before);
  const stored = await page.evaluate(() => {
    /**
     * Every key and value of a storage area, as one string.
     *
     * @param storage - `localStorage` or `sessionStorage`.
     * @returns Keys and values joined.
     */
    const dump = (storage: Storage): string =>
      Array.from({ length: storage.length }, (_, index) => {
        const key = storage.key(index) ?? '';
        return `${key}=${storage.getItem(key) ?? ''}`;
      }).join(';');
    return { local: dump(localStorage), session: dump(sessionStorage) };
  });
  expect(stored.local.toLowerCase()).not.toContain('calme');
  expect(stored.session.toLowerCase()).not.toContain('calme');
  expect((await sigilMarkup(page)).toLowerCase()).not.toContain('calme');
});
