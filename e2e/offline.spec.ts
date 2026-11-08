/**
 * End-to-end checks of the deployable PWA as served by `vite preview` under
 * the GitHub Pages base path `/sigil/`: every resource resolves under that
 * path, the manifest and its icons are reachable, the app reloads with the
 * network cut once the service worker has cached it, and the service worker
 * leaves navigations to the documentation site (`/sigil/docs/`) to the network.
 */
import { expect, test } from '@playwright/test';

import { waitForServiceWorkerControl } from './service-worker.ts';

/** GitHub Pages base path every site URL must start with. */
const BASE_PATH = '/sigil/';

/**
 * Home page of the documentation site, published by the deploy workflow inside
 * the app's scope; the app's own preview does not serve it.
 */
const DOCS_HOME = `${BASE_PATH}docs/`;

/** Documentation URLs checked: the home page, without its trailing slash, and a page under it. */
const DOCS_PATHS = [DOCS_HOME, `${BASE_PATH}docs`, `${DOCS_HOME}en/`];

/** Shape of the web app manifest fields checked here. */
interface WebAppManifest {
  start_url: string;
  scope: string;
  lang: string;
  display: string;
  icons: { src: string; sizes: string; purpose: string }[];
}

test('every resource is served under /sigil/ without error', async ({ page, context }) => {
  const failures: string[] = [];
  const outsideBasePath: string[] = [];
  // Context-level events also report the service worker's own requests (precache downloads).
  context.on('response', (response) => {
    if (response.status() >= 400) failures.push(`${String(response.status())} ${response.url()}`);
  });
  context.on('requestfailed', (request) => {
    failures.push(`${request.failure()?.errorText ?? 'failed'} ${request.url()}`);
  });
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && !url.pathname.startsWith(BASE_PATH)) {
      outsideBasePath.push(request.url());
    }
  });

  await page.goto('./');
  await waitForServiceWorkerControl(page);

  expect(failures).toEqual([]);
  expect(outsideBasePath).toEqual([]);
});

test('the manifest makes the app installable under /sigil/', async ({ page, request }) => {
  await page.goto('./');

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBe(`${BASE_PATH}manifest.webmanifest`);
  const manifestUrl = new URL(manifestHref ?? '', page.url());

  const manifestResponse = await request.get(manifestUrl.href);
  expect(manifestResponse.status()).toBe(200);
  const manifest = (await manifestResponse.json()) as WebAppManifest;
  expect(manifest).toMatchObject({
    start_url: BASE_PATH,
    scope: BASE_PATH,
    lang: 'fr',
    display: 'standalone',
  });
  expect(manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`)).toEqual(
    expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']),
  );

  for (const icon of manifest.icons) {
    const iconResponse = await request.get(new URL(icon.src, manifestUrl).href);
    expect(iconResponse.status(), icon.src).toBe(200);
    expect(iconResponse.headers()['content-type'], icon.src).toBe('image/png');
  }
});

test('after a first visit, the app reloads with the network cut', async ({ page, context }) => {
  await page.goto('./');
  await waitForServiceWorkerControl(page);

  await context.setOffline(true);
  const response = await page.reload();

  expect(response?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole('heading', { level: 1, name: 'Sigil' })).toBeVisible();
  // Fonts are precached too: the title face still loads without network.
  const titleFaceStatus = await page.evaluate(async () => {
    await document.fonts.load('500 1em "EB Garamond"');
    return [...document.fonts]
      .filter((face) => face.family.replaceAll('"', '') === 'EB Garamond' && face.weight === '500')
      .map((face) => face.status);
  });
  expect(titleFaceStatus).toContain('loaded');
});

test('the service worker leaves the documentation pages to the network', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await waitForServiceWorkerControl(page);

  for (const path of DOCS_PATHS) {
    // Without its exclusion, the worker's navigation fallback would answer with
    // the precached index.html of the app. Served by the network instead, the
    // page may be anything the server has (a 404, or the docs once published).
    const response = await page.goto(path);
    expect(response, path).not.toBeNull();
    expect(response?.fromServiceWorker(), path).toBe(false);
  }

  // Offline, the documentation is not served from the app's cache either.
  await page.goto('./');
  await context.setOffline(true);
  const offlineError = await page.goto(DOCS_HOME).then(
    () => null,
    (error: unknown) => error,
  );
  expect(offlineError).toBeInstanceOf(Error);
});
