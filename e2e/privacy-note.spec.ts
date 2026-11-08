/**
 * End-to-end checks of the privacy texts added after the review: the privacy
 * note opened from the footer (French and English, keyboard, phone width,
 * both themes), the note of the export dialog saying a kamea sigil can be
 * read back (and its absence for Spare), and the `translate="no"` marks on
 * the intention field and the letters of the explanation panel. The contrast
 * of the new texts is measured on the page, against the WCAG AA threshold.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** WCAG AA contrast ratio for body text. */
const AA_TEXT_CONTRAST = 4.5;

/** Phone width of the design's mobile layout, in CSS pixels. */
const PHONE = { width: 375, height: 812 } as const;

/**
 * Intention traced, one word (D18) whose Spare reduction removes duplicates
 * and vowels, so every row of the removal list holds letters.
 */
const INTENTION = 'Tranquillité';

/**
 * Contrast ratio of an element's text colour on the first opaque background
 * found on it or its ancestors (WCAG 2.x relative luminance).
 *
 * @param element - Element whose text is measured.
 * @returns The ratio, from 1 to 21.
 */
async function textContrast(element: Locator): Promise<number> {
  return element.evaluate((node) => {
    /**
     * Parses a computed `rgb()` / `rgba()` colour.
     *
     * @param value - Computed colour.
     * @returns Red, green, blue (0–255) and alpha (0–1).
     */
    const parse = (value: string): number[] =>
      (value.match(/[\d.]+/g) ?? []).map(Number).concat([1]).slice(0, 4);
    /**
     * Relative luminance of an sRGB colour.
     *
     * @param rgb - Red, green and blue, 0–255.
     * @returns The luminance, 0–1.
     */
    const luminance = (rgb: number[]): number => {
      const [r = 0, g = 0, b = 0] = rgb.map((channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    let background: number[] = [255, 255, 255, 1];
    for (let current: Element | null = node; current !== null; current = current.parentElement) {
      const colour = parse(getComputedStyle(current).backgroundColor);
      if ((colour[3] ?? 0) > 0) {
        background = colour;
        break;
      }
    }
    const text = luminance(parse(getComputedStyle(node).color));
    const back = luminance(background);
    return (Math.max(text, back) + 0.05) / (Math.min(text, back) + 0.05);
  });
}

/**
 * Types the intention and traces it with the method chosen.
 *
 * @param page - Page of the app.
 * @param method - Method radio to select first.
 */
async function trace(page: Page, method: 'Kamea' | 'Spare'): Promise<void> {
  await page.getByRole('radio', { name: method }).check({ force: true });
  await page.getByLabel('Intention').fill(INTENTION);
  await page.getByRole('button', { name: 'Tracer' }).click();
}

/**
 * Opens the privacy note from the footer.
 *
 * @param page - Page of the app.
 * @param name - Label of the footer button in the interface language.
 * @returns The dialog.
 */
async function openPrivacyNote(page: Page, name = 'Confidentialité'): Promise<Locator> {
  await page.getByRole('contentinfo').getByRole('button', { name }).click();
  const dialog = page.getByRole('dialog', { name });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('privacy note', () => {
  test('says what happens to the data, in French, and closes with Escape', async ({ page }) => {
    await page.goto('./');
    const opener = page.getByRole('contentinfo').getByRole('button', { name: 'Confidentialité' });

    const dialog = await openPrivacyNote(page);
    await expect(dialog).toContainText('L’intention n’est envoyée nulle part ni enregistrée');
    await expect(dialog).toContainText('la langue et le thème');
    await expect(dialog).toContainText('GitHub Pages, qui journalise les adresses IP');
    await expect(dialog).toContainText('Un sigil kamea peut être relu');
    for (const paragraph of await dialog.locator('p').all()) {
      expect(await textContrast(paragraph)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('is reachable by keyboard and closes with its button', async ({ page }) => {
    await page.goto('./');
    const opener = page.getByRole('contentinfo').getByRole('button', { name: 'Confidentialité' });
    await opener.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'Confidentialité' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Fermer' }).click();
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('reads in English with the English interface', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('radio', { name: 'English' }).check({ force: true });

    const dialog = await openPrivacyNote(page, 'Privacy');
    await expect(dialog).toContainText('The intention is never sent anywhere or saved');
    await expect(dialog).toContainText('the language and the theme');
    await expect(dialog).toContainText('GitHub Pages, which logs visitors’ IP addresses');
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible();
  });

  test('fits a phone and keeps its footer button and text legible on both themes', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto('./');
    const opener = page.getByRole('contentinfo').getByRole('button', { name: 'Confidentialité' });

    for (const theme of ['Encre sur papier', 'Or sur noir']) {
      await page.getByRole('radio', { name: theme }).check({ force: true });
      // Polled: the colours fade from one theme to the other for a moment.
      await expect.poll(() => textContrast(opener)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
      const box = await opener.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

      const dialog = await openPrivacyNote(page);
      for (const paragraph of await dialog.locator('p').all()) {
        await expect.poll(() => textContrast(paragraph)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await dialog.getByRole('button', { name: 'Fermer' }).click();
      await expect(dialog).toBeHidden();
    }
  });
});

test.describe('kamea note of the export dialog', () => {
  test('tells that a kamea sigil can be read back, on every format', async ({ page }) => {
    await page.goto('./');
    await trace(page, 'Kamea');
    await page.getByRole('button', { name: 'Exporter' }).click();
    const dialog = page.getByRole('dialog', { name: 'Exporter le sigil' });
    const note = dialog.getByText(/peut être relu par quelqu’un qui connaît la méthode/);

    for (const format of ['SVG', 'PNG', 'PDF']) {
      await dialog.getByRole('radio', { name: format }).check({ force: true });
      await expect(note).toBeVisible();
    }
    expect(await textContrast(note)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
  });

  test('stays legible on the gold on black theme', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('radio', { name: 'Or sur noir' }).check({ force: true });
    await trace(page, 'Kamea');
    await page.getByRole('button', { name: 'Exporter' }).click();
    const note = page
      .getByRole('dialog', { name: 'Exporter le sigil' })
      .getByText(/peut être relu par quelqu’un/);

    await expect(note).toBeVisible();
    await expect.poll(() => textContrast(note)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
  });

  test('is not shown for a Spare sigil', async ({ page }) => {
    await page.goto('./');
    await trace(page, 'Spare');
    await page.getByRole('button', { name: 'Exporter' }).click();
    const dialog = page.getByRole('dialog', { name: 'Exporter le sigil' });

    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/peut être relu/)).toHaveCount(0);
  });
});

test.describe('translation marks', () => {
  test('keep the intention field and the letters of both panels out of page translation', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(page.getByLabel('Intention')).toHaveAttribute('translate', 'no');

    await trace(page, 'Kamea');
    await expect(page.locator('.explain-steps__letters [translate="no"]')).toHaveText(
      'TRANQUILLITE',
    );
    await expect(page.locator('.letter-table__letter[translate="no"]')).toHaveCount(12);

    await trace(page, 'Spare');
    await expect(page.locator('.letter-strip [translate="no"]')).toHaveCount(12);
    await expect(page.locator('.spare-removal dd[translate="no"]')).toHaveCount(3);
  });
});
