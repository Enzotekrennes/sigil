/**
 * End-to-end check of the home page as served by `vite preview` under the
 * GitHub Pages base path `/sigil/`.
 */
import { expect, test } from '@playwright/test';

test('home page shows the title with the local fonts loaded', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') fontRequests.push(request.url());
  });

  await page.goto('./');

  await expect(page).toHaveTitle('Sigil');
  await expect(page.getByRole('heading', { level: 1, name: 'Sigil' })).toBeVisible();

  // The title is set in EB Garamond 500: that face must be declared and loaded.
  const loadedTitleFaces = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.family.replaceAll('"', '') === 'EB Garamond' && face.weight === '500')
      .map((face) => face.status);
  });
  expect(loadedTitleFaces).toContain('loaded');

  expect(fontRequests.length).toBeGreaterThan(0);
  for (const url of fontRequests) {
    expect(new URL(url).pathname).toMatch(/^\/sigil\/assets\/.+\.woff2$/);
  }
});
