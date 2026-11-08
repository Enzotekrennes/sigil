/**
 * End-to-end checks of the bilingual interface (scenario F6) on the built
 * site: an English browser gets the English interface on first load, any
 * other gets French, the header switch is kept across a reload, switching
 * keeps the intention and the sigil, and `localStorage` holds the language
 * code and nothing else.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Key documented in `src/features/i18n/storage.ts`. */
const LANGUAGE_STORAGE_KEY = 'sigil.language';

/**
 * Every key and value of `localStorage` and `sessionStorage`.
 *
 * @param page - Page to inspect.
 * @returns Both storage areas as plain objects.
 */
async function storageEntries(page: Page) {
  return page.evaluate(() => {
    const dump = (storage: Storage) =>
      Object.fromEntries(
        Array.from({ length: storage.length }, (_, index) => {
          const key = storage.key(index) ?? '';
          return [key, storage.getItem(key)];
        }),
      );
    return { local: dump(localStorage), session: dump(sessionStorage) };
  });
}

test.describe('with an English browser', () => {
  test.use({ locale: 'en-US' });

  test('opens in English, with <html lang="en"> and nothing stored', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByRole('button', { name: 'Trace', exact: true })).toBeVisible();
    await expect(page.getByLabel('Intention')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Planetary square' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'English' })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await storageEntries(page)).toEqual({ local: {}, session: {} });
  });

  test('traces and explains in English', async ({ page }) => {
    await page.goto('./');

    await page.getByLabel('Intention').fill('Calm');
    await page.getByRole('button', { name: 'Trace', exact: true }).click();

    await expect(page.getByRole('img', { name: 'Kamea sigil of Saturn' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'How it’s made' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conversion rule' })).toBeVisible();
  });

  test('writes the colons of the Spare panel the English way, with no space before them', async ({
    page,
  }) => {
    await page.goto('./');

    await page.getByText('Spare', { exact: true }).click();
    await page.getByLabel('Intention').fill('Strength');
    await page.getByRole('button', { name: 'Trace', exact: true }).click();

    // The colon must be text of the label: no generated content (`::after` is "none") adds a space.
    const labels = await page
      .locator('.spare-removal dt')
      .evaluateAll((terms) =>
        terms.map(
          (term) =>
            `${(term as HTMLElement).innerText}${getComputedStyle(term, '::after').content}`,
        ),
      );
    expect(labels).toEqual(['Duplicates:none', 'Vowels:none', 'Kept:none']);
    const panel = page.locator('details', {
      has: page.getByRole('heading', { name: 'How it’s made' }),
    });
    expect(await panel.innerText()).not.toMatch(/\s:/);
  });
});

test.describe('with a French browser', () => {
  test.use({ locale: 'fr-FR' });

  test('opens in French', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByRole('button', { name: 'Tracer', exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Français' })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('keeps the language picked across a reload, and stores only that', async ({ page }) => {
    await page.goto('./');

    await page.getByLabel('Intention').fill('Calme');
    await page.getByRole('button', { name: 'Tracer', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Sigil kamea de Saturne' })).toBeVisible();
    // The switch is drawn on the label; the radio itself is visually hidden.
    await page.getByText('EN', { exact: true }).click();

    await expect(page.getByRole('img', { name: 'Kamea sigil of Saturn' })).toBeVisible();
    await expect(page.getByLabel('Intention')).toHaveValue('Calme');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await storageEntries(page)).toEqual({
      local: { [LANGUAGE_STORAGE_KEY]: 'en' },
      session: {},
    });

    await page.reload();

    await expect(page.getByRole('button', { name: 'Trace', exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'English' })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await storageEntries(page)).toEqual({
      local: { [LANGUAGE_STORAGE_KEY]: 'en' },
      session: {},
    });
  });

  test('switches with the keyboard', async ({ page }) => {
    await page.goto('./');

    await page.getByRole('radio', { name: 'Français' }).focus();
    await page.keyboard.press('ArrowRight');

    await expect(page.getByRole('radio', { name: 'English' })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Trace', exact: true })).toBeVisible();
  });

  test('ignores an invalid stored value and detects again', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'de');
    }, LANGUAGE_STORAGE_KEY);
    await page.goto('./');

    await expect(page.getByRole('button', { name: 'Tracer', exact: true })).toBeVisible();
  });
});
