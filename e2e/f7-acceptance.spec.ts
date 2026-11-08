/**
 * Acceptance scenarios of feature F7 (offline, private and deployable app),
 * played on the production build served under `/sigil/` (`vite preview`): the
 * four scenarios of the plan, plus the checks around them.
 *
 * - Offline: after one visit, with the network cut, the app reloads and keeps
 *   working in full (both methods, explanation panel, language and theme,
 *   SVG, PNG and PDF exports; the PDF library is a lazy chunk that must be in
 *   the precache).
 * - Network: a complete journey reaches no origin other than the site's, in
 *   any request of the page or of the service worker, and carries no body.
 * - Privacy: the typed intention is in no URL, title, history entry, cookie,
 *   `localStorage`, `sessionStorage`, IndexedDB, Cache Storage content or
 *   exported file name; `localStorage` holds `sigil.language` and
 *   `sigil.theme` only.
 * - Deployment: every link and resource resolves with a 200 under `/sigil/`,
 *   the manifest meets Chromium's installability criteria, the CSP is
 *   enforced with the dialog open, and `deploy.yml` follows its security
 *   rules (minimal permissions, no secret, pinned action versions).
 * - Licences: the site publishes and precaches its licence, NOTICE, the Open
 *   Font Licenses of both font families and the third-party notices, the
 *   Workbox ones at the version actually bundled.
 *
 * Files and screenshots are kept in `F7_EVIDENCE_DIR` (default
 * `test-results/f7-evidence`).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

import { expect, test } from '@playwright/test';
import type { BrowserContext, Download, Page, Request } from '@playwright/test';

import { waitForServiceWorkerControl } from './service-worker.ts';

/** Where exported files and screenshots are kept for review. */
const EVIDENCE_DIR = resolve(process.env.F7_EVIDENCE_DIR ?? 'test-results/f7-evidence');

/** GitHub Pages base path every site URL must start with. */
const BASE_PATH = '/sigil/';

/** Unusual intention, one word (D18) with an accent, so that any leak is recognisable. */
const INTENTION = 'Zéphyr';

/** Fragments that identify the intention anywhere, searched case-insensitively. */
const LEAK_NEEDLES = ['zéphyr', 'zephyr', 'z%c3%a9phyr', 'zphyr'] as const;

/** Keys the app may write to `localStorage` (language and theme choices only). */
const ALLOWED_STORAGE_KEYS = ['sigil.language', 'sigil.theme'];

/** URL schemes that stay inside the browser and never reach the network. */
const LOCAL_SCHEMES = new Set(['data:', 'blob:']);

/** Export formats of the dialog with the first bytes each file must start with. */
const FORMATS = [
  { label: 'SVG', start: '<' },
  { label: 'PNG', start: '\u0089PNG' },
  { label: 'PDF', start: '%PDF-' },
] as const;

/** Neutral file name of an export (decision D8): no trace of the intention. */
const FILE_NAME = /^sigil-(kamea|spare)-\d{8}-\d{6}\.(svg|png|pdf)$/;

test.use({ reducedMotion: 'reduce' });

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
 * Collects every request of the context (page and service worker).
 *
 * @param context - Browser context to watch.
 * @returns The live list of requests seen.
 */
function recordRequests(context: BrowserContext): Request[] {
  const requests: Request[] = [];
  context.on('request', (request) => requests.push(request));
  return requests;
}

/**
 * Reads the `permissions:` map that starts at the given indentation of a
 * workflow (or of one of its jobs).
 *
 * @param yaml - Workflow text, or the text of one job.
 * @param indent - Regular-expression fragment for the spaces before `permissions:`
 *   (`''` at workflow level, `' {4}'` inside a job).
 * @returns The `scope: access` lines, trimmed and sorted; empty when there is no such map.
 */
function permissionsBlock(yaml: string, indent: string): string[] {
  const pattern = new RegExp(`^${indent}permissions:\\n((?:${indent} {2}\\S.*\\n)+)`, 'm');
  const block = pattern.exec(yaml)?.[1] ?? '';
  return block
    .split('\n')
    .filter(Boolean)
    .map((line) => line.trim())
    .sort();
}

/**
 * Extracts one job of a workflow, up to the next job or the end of the file.
 *
 * @param yaml - Workflow text.
 * @param job - Job identifier under `jobs:`.
 * @returns The job's lines, its header included.
 * @throws {Error} When the workflow has no such job.
 */
function jobBlock(yaml: string, job: string): string {
  const found = new RegExp(`^ {2}${job}:\\n(?:(?: {4}.*)?\\n)*`, 'm').exec(yaml);
  if (found === null) throw new Error(`deploy.yml has no "${job}" job.`);
  return found[0];
}

/**
 * Types an intention and traces it with the chosen method.
 *
 * @param page - Page on the app (French interface).
 * @param method - Method to trace with.
 */
async function trace(page: Page, method: 'kamea' | 'spare'): Promise<void> {
  await page.getByRole('textbox', { name: 'Intention' }).fill(INTENTION);
  if (method === 'spare') await page.getByRole('radio', { name: 'Spare' }).check({ force: true });
  else await page.getByRole('radio', { name: /^Saturne/ }).check({ force: true });
  await page.getByRole('button', { name: 'Tracer' }).click();
  await expect(page.getByRole('img', { name: /^Sigil (kamea|de Spare)/ })).toBeVisible();
}

/**
 * Opens the "Comment c'est fait" panel of the drawn sigil.
 *
 * @param page - Page showing a sigil.
 */
async function openExplanation(page: Page): Promise<void> {
  const summary = page.locator('summary', { hasText: 'Comment c’est fait' });
  const details = page.locator('details', { has: summary });
  if ((await details.getAttribute('open')) === null) await summary.click();
  await expect(details).toHaveAttribute('open', '');
  await expect(details.getByRole('heading', { level: 3 }).first()).toBeVisible();
}

/**
 * Exports the sigil through the dialog and returns the file.
 *
 * @param page - Page showing a sigil.
 * @param format - Label of the format.
 * @returns The download and the first bytes of the file as a string.
 */
async function exportAs(
  page: Page,
  format: (typeof FORMATS)[number]['label'],
): Promise<{ download: Download; head: string; body: Buffer }> {
  await page.getByRole('button', { name: 'Exporter', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Exporter le sigil' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: format, exact: true }).check({ force: true });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Télécharger' }).click(),
  ]);
  const path = await download.path();
  const body = await readFile(path);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeFile(join(EVIDENCE_DIR, download.suggestedFilename()), body);
  await expect(dialog).toBeHidden();
  return { download, head: body.subarray(0, 8).toString('latin1'), body };
}

/**
 * Plays a complete journey: both methods, panel, three exports, language and theme.
 *
 * @param page - Page on the app, French interface, reduced motion.
 * @param exported - Receives the name and size of each file exported.
 */
async function playJourney(page: Page, exported: string[] = []): Promise<void> {
  await trace(page, 'kamea');
  await openExplanation(page);
  for (const { label, start } of FORMATS) {
    const { download, head, body } = await exportAs(page, label);
    const name = download.suggestedFilename();
    expect(name, label).toMatch(FILE_NAME);
    expect(head.startsWith(start), `${label} starts with ${JSON.stringify(head)}`).toBe(true);
    expect(body.length, label).toBeGreaterThan(500);
    exported.push(`${name} ${String(body.length)}`);
  }

  await trace(page, 'spare');
  await openExplanation(page);
  const spareSvg = await exportAs(page, 'SVG');
  expect(spareSvg.download.suggestedFilename()).toMatch(/^sigil-spare-/);
  exported.push(`${spareSvg.download.suggestedFilename()} ${String(spareSvg.body.length)}`);

  await page.getByRole('radio', { name: 'English' }).check({ force: true });
  await expect(page.getByRole('button', { name: 'Trace', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Gold on black' }).check({ force: true });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
}

/**
 * Looks for the intention in every place the browser can keep it.
 *
 * @param page - Page that played a journey with the intention.
 * @returns A map from location to the fragments of the intention found there.
 */
async function findLeaks(page: Page): Promise<Record<string, string[]>> {
  const found = await page.evaluate(async (needles) => {
    const leaks: Record<string, string[]> = {};
    const search = (where: string, text: string): void => {
      const lower = text.toLowerCase();
      const hits = needles.filter((needle) => lower.includes(needle));
      if (hits.length > 0) leaks[where] = hits;
    };

    search('url', decodeURIComponent(location.href) + location.href);
    search('title', document.title);
    search('cookie', document.cookie);
    search('history.state', JSON.stringify(history.state));
    for (const key of Object.keys(localStorage)) {
      search(`localStorage:${key}`, key + String(localStorage.getItem(key)));
    }
    for (const key of Object.keys(sessionStorage)) {
      search(`sessionStorage:${key}`, key + String(sessionStorage.getItem(key)));
    }

    for (const info of await indexedDB.databases()) {
      if (info.name === undefined) continue;
      const name = info.name;
      const db = await new Promise<IDBDatabase>((done, fail) => {
        const open = indexedDB.open(name);
        open.onsuccess = (): void => {
          done(open.result);
        };
        open.onerror = (): void => {
          fail(open.error ?? new Error('indexedDB open failed'));
        };
      });
      for (const store of Array.from(db.objectStoreNames)) {
        const rows = await new Promise<unknown[]>((done, fail) => {
          const all = db.transaction(store).objectStore(store).getAll();
          all.onsuccess = (): void => {
            done(all.result as unknown[]);
          };
          all.onerror = (): void => {
            fail(all.error ?? new Error('indexedDB read failed'));
          };
        });
        search(`indexedDB:${name}/${store}`, JSON.stringify(rows));
      }
      db.close();
    }

    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      for (const request of await cache.keys()) {
        search(`cache:${cacheName}:url:${request.url}`, request.url);
        const response = await cache.match(request);
        if (response === undefined) continue;
        const bytes = new Uint8Array(await response.arrayBuffer());
        let text = '';
        for (const byte of bytes) text += String.fromCharCode(byte);
        search(`cache:${cacheName}:body:${request.url}`, text);
        // The same bytes read as UTF-8, for accented needles.
        search(`cache:${cacheName}:utf8:${request.url}`, new TextDecoder().decode(bytes));
      }
    }
    return leaks;
  }, LEAK_NEEDLES);
  return found;
}

test('S1: after a first visit, the network cut and a reload, the whole app works', async ({
  page,
  context,
}) => {
  await watchCsp(page);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('./');
  await waitForServiceWorkerControl(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Sigil' })).toBeVisible();

  await context.setOffline(true);
  const offlineRequests = recordRequests(context);
  const reloaded = await page.reload();
  expect(reloaded?.fromServiceWorker(), 'the reload is answered by the service worker').toBe(true);
  await expect(page.getByRole('heading', { level: 1, name: 'Sigil' })).toBeVisible();

  const exported: string[] = [];
  await playJourney(page, exported);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: join(EVIDENCE_DIR, 's1-offline-journey.png') });

  // A new navigation offline (another entry URL of the site) is served too.
  await page.goto('./index.html');
  await expect(page.getByRole('heading', { level: 1, name: 'Sigil' })).toBeVisible();
  // Language and theme chosen offline survive an offline reload.
  await expect(page.getByRole('radio', { name: 'English' })).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const pageRequests = offlineRequests
    .filter((request) => !LOCAL_SCHEMES.has(new URL(request.url()).protocol))
    .filter((request) => request.serviceWorker() === null);
  const notFromWorker: string[] = [];
  for (const request of pageRequests) {
    const response = await request.response();
    if (response?.fromServiceWorker() !== true) notFromWorker.push(request.url());
  }
  expect(pageRequests.length).toBeGreaterThan(5);
  // Every request of the page was answered by the worker's cache, none by the network.
  expect(notFromWorker).toEqual([]);
  const failed = offlineRequests.filter((request) => request.failure() !== null);
  expect(failed.map((request) => `${request.url()} ${request.failure()?.errorText ?? ''}`)).toEqual(
    [],
  );
  expect(pageErrors).toEqual([]);
  expect(await cspViolations(page)).toEqual([]);
  await writeFile(
    join(EVIDENCE_DIR, 's1-offline.json'),
    JSON.stringify({ exported, notFromWorker, requests: offlineRequests.length }, null, 2),
  );
});

test('S1b: the PDF library chunk is precached and only fetched by the page on demand', async ({
  page,
  context,
}) => {
  const requests = recordRequests(context);
  await page.goto('./');
  await waitForServiceWorkerControl(page);

  const cachedUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
  const chunk = cachedUrls.find((url) => /\/assets\/es-[\w-]+\.js$/.test(url));
  expect(chunk, 'the lazy pdf-lib chunk is in the precache').toBeDefined();
  // Unhashed files are cached under a `?__WB_REVISION__=` URL.
  expect(cachedUrls.some((url) => url.includes('/manifest.webmanifest'))).toBe(true);
  expect(cachedUrls.some((url) => url.includes('/theme-init.js'))).toBe(true);

  // Loading and tracing never asks for the chunk; choosing PDF does.
  await trace(page, 'kamea');
  const pageAsked = (): string[] =>
    requests
      .filter((request) => request.serviceWorker() === null)
      .map((request) => request.url())
      .filter((url) => /\/assets\/es-[\w-]+\.js$/.test(url));
  expect(pageAsked()).toEqual([]);
  await exportAs(page, 'PDF');
  expect(pageAsked().length).toBeGreaterThan(0);
});

test('S2: a complete journey reaches nothing outside the site files', async ({
  page,
  context,
  baseURL,
}) => {
  const siteOrigin = new URL(baseURL ?? '').origin;
  const requests = recordRequests(context);
  const sockets: string[] = [];
  page.on('websocket', (socket) => sockets.push(socket.url()));
  await watchCsp(page);

  await page.goto('./');
  await waitForServiceWorkerControl(page);
  await playJourney(page);
  await page.reload();
  await page.getByRole('radio', { name: 'English' }).waitFor({ state: 'attached' });

  const seen = requests
    .filter((request) => !LOCAL_SCHEMES.has(new URL(request.url()).protocol))
    .map((request) => ({
      url: request.url(),
      method: request.method(),
      body: request.postData(),
      worker: request.serviceWorker() !== null,
    }));
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeFile(join(EVIDENCE_DIR, 's2-requests.json'), JSON.stringify(seen, null, 2));

  expect(seen.length).toBeGreaterThan(20);
  expect(seen.filter((entry) => new URL(entry.url).origin !== siteOrigin)).toEqual([]);
  expect(seen.filter((entry) => !new URL(entry.url).pathname.startsWith(BASE_PATH))).toEqual([]);
  expect(seen.filter((entry) => entry.method !== 'GET')).toEqual([]);
  expect(seen.filter((entry) => entry.body !== null)).toEqual([]);
  expect(sockets).toEqual([]);
  // The intention is in no request URL (lower-cased, decoded or not).
  const urls = seen.map((entry) => entry.url.toLowerCase()).join('\n');
  for (const needle of LEAK_NEEDLES) expect(urls, needle).not.toContain(needle);
  expect(await cspViolations(page)).toEqual([]);
});

test('S3: the intention is in no URL, title, history, cookie or browser storage', async ({
  page,
  context,
}) => {
  await watchCsp(page);
  await page.goto('./');
  await waitForServiceWorkerControl(page);
  await playJourney(page);

  const historyBefore = await page.evaluate(() => history.length);
  const leaks = await findLeaks(page);
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const storage = await page.evaluate(async () => ({
    url: location.href,
    title: document.title,
    historyLength: history.length,
    historyState: history.state as unknown,
    localStorage: Object.fromEntries(Object.entries(localStorage)),
    sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
    indexedDB: (await indexedDB.databases()).map((info) => info.name),
    caches: await caches.keys(),
    cookie: document.cookie,
  }));
  await writeFile(join(EVIDENCE_DIR, 's3-storage.json'), JSON.stringify(storage, null, 2));

  expect(leaks).toEqual({});
  expect(storage.url).toBe(new URL('./', page.url()).href);
  expect(storage.title).toBe('Sigil');
  expect(storage.historyLength).toBe(historyBefore);
  expect(Object.keys(storage.localStorage).sort()).toEqual(ALLOWED_STORAGE_KEYS);
  expect(storage.sessionStorage).toEqual({});
  expect(storage.indexedDB).toEqual([]);
  expect(storage.cookie).toBe('');

  // The intention is not restored after a reload or a new tab, and the field starts empty.
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Intention' })).toHaveValue('');
  const another = await context.newPage();
  await another.goto('./');
  await expect(another.getByRole('textbox', { name: 'Intention' })).toHaveValue('');
  expect(await findLeaks(another)).toEqual({});
});

test('S3b: localStorage stays empty until a language or theme is chosen explicitly', async ({
  page,
}) => {
  await page.goto('./');
  await waitForServiceWorkerControl(page);
  await trace(page, 'kamea');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);

  await page.getByRole('radio', { name: 'English' }).check({ force: true });
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual(['sigil.language']);
  await page.getByRole('radio', { name: 'Gold on black' }).check({ force: true });
  expect(
    (await page.evaluate(() => Object.keys(localStorage))).sort(),
    'only the two choices are stored',
  ).toEqual(ALLOWED_STORAGE_KEYS);
});

test('S3c: going back and forward does not put the intention in the history', async ({ page }) => {
  await page.goto('./');
  await trace(page, 'spare');
  await page.goto('./index.html');
  await page.goBack();
  expect(page.url()).not.toMatch(/z[eé]phyr|z%C3%A9phyr/i);
  expect(new URL(page.url()).search).toBe('');
  expect(new URL(page.url()).hash).toBe('');
  await expect(page.getByRole('heading', { level: 1, name: 'Sigil' })).toBeVisible();
});

test('S4: every link and resource resolves with a 200 under /sigil/', async ({
  page,
  request,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? '').origin;
  const html = await (await request.get('./')).text();
  const references = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((match) => match[1] ?? '');
  expect(references.length).toBeGreaterThan(5);

  const checked: string[] = [];
  /**
   * Fetches a site URL and records it.
   *
   * @param url - Absolute URL or absolute path on the site.
   */
  async function expectOk(url: string): Promise<void> {
    expect(url.startsWith(BASE_PATH) || url.startsWith(origin + BASE_PATH), url).toBe(true);
    const response = await request.get(new URL(url, origin).href);
    expect(response.status(), url).toBe(200);
    checked.push(`${String(response.status())} ${url}`);
  }

  for (const reference of references) await expectOk(reference);

  // Every file the service worker precaches exists at its place under the base path.
  const worker = await (await request.get(`${BASE_PATH}sw.js`)).text();
  const precached = [...worker.matchAll(/url:"([^"]+)"/g)].map((match) => match[1] ?? '');
  expect(precached.length).toBeGreaterThan(20);
  for (const url of precached) await expectOk(BASE_PATH + url);

  // Built files never point outside the base path (absolute asset URLs in CSS or scripts).
  const assets = precached.filter((url) => /\.(css|js)$/.test(url) && url.startsWith('assets/'));
  for (const url of assets) {
    const text = await (await request.get(BASE_PATH + url)).text();
    const stray = [
      ...text.matchAll(/["'`(]\/(?!sigil\/)(?:assets|icon|pwa|apple|manifest|theme)[\w./-]*/g),
    ];
    expect(
      stray.map((match) => match[0]),
      url,
    ).toEqual([]);
  }

  // Links and images rendered in the page.
  await page.goto('./');
  const internal = await page.evaluate(() =>
    [...document.querySelectorAll('a[href], img[src], link[href], script[src]')].map(
      (element) => (element as HTMLAnchorElement).href || (element as HTMLImageElement).src,
    ),
  );
  for (const url of internal) {
    if (url.startsWith('blob:') || url.startsWith('data:')) continue;
    expect(new URL(url).origin, `external reference ${url}`).toBe(origin);
    await expectOk(new URL(url).pathname);
  }

  await mkdir(EVIDENCE_DIR, { recursive: true });
  await writeFile(
    join(EVIDENCE_DIR, 's4-links.txt'),
    [...checked, '--- page', ...internal].join('\n'),
  );
});

test('S4b: the manifest meets the installability criteria of Chromium', async ({
  page,
  context,
  request,
}) => {
  await page.goto('./');
  await waitForServiceWorkerControl(page);
  const client = await context.newCDPSession(page);

  const manifest = (await client.send('Page.getAppManifest')) as {
    url?: string;
    errors: { message: string }[];
    data?: string;
  };
  expect(manifest.errors).toEqual([]);
  const parsed = JSON.parse(manifest.data ?? '{}') as {
    start_url: string;
    scope: string;
    display: string;
    name: string;
    icons: { src: string; sizes: string; type: string; purpose: string }[];
  };
  expect(new URL(parsed.start_url, manifest.url).pathname).toBe(BASE_PATH);
  expect(new URL(parsed.scope, manifest.url).pathname).toBe(BASE_PATH);
  expect(parsed.display).toBe('standalone');
  expect(parsed.name).not.toBe('');
  for (const size of ['192x192', '512x512']) {
    const icon = parsed.icons.find(
      (candidate) => candidate.sizes === size && candidate.purpose === 'any',
    );
    expect(icon, `icon ${size}`).toBeDefined();
    const response = await request.get(new URL(icon?.src ?? '', manifest.url).href);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');
    expect((await response.body()).subarray(1, 4).toString('latin1')).toBe('PNG');
  }
  // The start URL itself answers offline (checked by S1), and no criterion is unmet.
  const installability = (await client.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: { errorId: string }[];
  };
  expect(installability.installabilityErrors).toEqual([]);

  const registration = await page.evaluate(async () => {
    const found = await navigator.serviceWorker.getRegistration();
    return { scope: found?.scope, active: found?.active?.scriptURL };
  });
  expect(new URL(registration.scope ?? '').pathname).toBe(BASE_PATH);
  expect(new URL(registration.active ?? '').pathname).toBe(`${BASE_PATH}sw.js`);
});

test('S5: the CSP is enforced on the page and with the export dialog open', async ({ page }) => {
  await watchCsp(page);
  await page.goto('./');

  const head = await page.evaluate(() =>
    [...document.head.children].map(
      (node) =>
        `${node.tagName}:${node.getAttribute('http-equiv') ?? node.getAttribute('src') ?? ''}`,
    ),
  );
  const cspPosition = head.indexOf('META:Content-Security-Policy');
  expect(cspPosition, 'the CSP meta exists').toBeGreaterThan(-1);
  const firstScript = head.findIndex((entry) => entry.startsWith('SCRIPT:'));
  expect(firstScript, 'the CSP comes before every script').toBeGreaterThan(cspPosition);

  await trace(page, 'kamea');
  await page.getByRole('button', { name: 'Exporter', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Exporter le sigil' });
  await expect(dialog).toBeVisible();
  // The dialog lives in the same document: same policy, probed from inside it.
  const outcome = await page.evaluate(async () => {
    const dialogElement = document.querySelector('dialog');
    const script = document.createElement('script');
    script.textContent = 'document.documentElement.dataset.probe = "ran";';
    dialogElement?.append(script);
    const styled = document.createElement('div');
    styled.setAttribute('style', 'width: 123px');
    dialogElement?.append(styled);
    const cspMetas = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').length;
    const inSameDocument = dialogElement?.ownerDocument === document;
    const outbound = await fetch('https://example.com/', { mode: 'no-cors' }).then(
      () => 'allowed',
      () => 'blocked',
    );
    return {
      ran: document.documentElement.dataset.probe === 'ran',
      width: getComputedStyle(styled).width,
      cspMetas,
      inSameDocument,
      outbound,
    };
  });
  expect(outcome).toMatchObject({
    ran: false,
    cspMetas: 1,
    inSameDocument: true,
    outbound: 'blocked',
  });
  expect(outcome.width).not.toBe('123px');
  // Violation events are dispatched asynchronously: wait until the probes are reported.
  const reported = async (directive: string): Promise<boolean> =>
    (await cspViolations(page)).some((entry) => entry.startsWith(directive));
  await expect.poll(() => reported('script-src')).toBe(true);
  await expect.poll(() => reported('connect-src')).toBe(true);
  const violations = await cspViolations(page);
  // Only the probes above violated the policy: none came from the app itself.
  expect(violations.every((entry) => /^(script-src|style-src|connect-src)/.test(entry))).toBe(true);
  await page.screenshot({ path: join(EVIDENCE_DIR, 's5-dialog-csp.png') });
});

test('S8: the legal files are published, precached and name what is shipped', async ({
  request,
}) => {
  const worker = await (await request.get(`${BASE_PATH}sw.js`)).text();
  const precached = [...worker.matchAll(/url:"([^"]+)"/g)].map((match) => match[1] ?? '');
  const published = {
    'LICENSE.txt': 'LICENSE',
    'NOTICE.txt': 'NOTICE',
    'OFL-EB-Garamond.txt': 'src/assets/fonts/eb-garamond/OFL.txt',
    'OFL-IBM-Plex-Mono.txt': 'src/assets/fonts/ibm-plex-mono/OFL.txt',
  };
  for (const [name, source] of Object.entries(published)) {
    expect(precached, name).toContain(name);
    const response = await request.get(`${BASE_PATH}${name}`);
    expect(response.status(), name).toBe(200);
    // Same text as the repository file, whatever line endings the checkout used.
    const repository = (await readFile(resolve(source), 'utf8')).replaceAll('\r\n', '\n');
    expect((await response.text()).replaceAll('\r\n', '\n'), name).toBe(repository);
  }
  expect(precached).toContain('THIRD-PARTY-LICENSES.txt');

  // NOTICE and LICENSE send the reader to files that exist on the site.
  const notice = await (await request.get(`${BASE_PATH}NOTICE.txt`)).text();
  const license = await (await request.get(`${BASE_PATH}LICENSE.txt`)).text();
  for (const name of ['OFL-EB-Garamond.txt', 'OFL-IBM-Plex-Mono.txt']) {
    expect(notice, name).toContain(name);
    expect(license.replace(/\s+/g, ' '), name).toContain(name);
  }

  // Every Workbox package of the runtime has its notice, at the version of the
  // copy workbox-build bundles (the root node_modules could hold another one).
  const runtimeName = /\.\/(workbox-[\da-f]+)/.exec(worker)?.[1];
  expect(runtimeName, 'sw.js loads a Workbox runtime').toBeDefined();
  const runtime = await (await request.get(`${BASE_PATH}${String(runtimeName)}.js`)).text();
  const markers = new Map(
    [...runtime.matchAll(/workbox:([a-z-]+):(\d+)\.(\d+)\.\d+/g)].map((match) => [
      `workbox-${match[1] ?? ''}`,
      `${match[2] ?? ''}.${match[3] ?? ''}`,
    ]),
  );
  expect(markers.size).toBeGreaterThan(0);
  const notices = await (await request.get(`${BASE_PATH}THIRD-PARTY-LICENSES.txt`)).text();
  const listed = new Map(
    [...notices.matchAll(/^## (workbox-[a-z-]+) - (\S+) \(/gm)].map((match) => [
      match[1] ?? '',
      match[2] ?? '',
    ]),
  );
  expect([...listed.keys()].sort()).toEqual([...markers.keys()].sort());
  const fromPlugin = createRequire(
    createRequire(resolve('package.json')).resolve('vite-plugin-pwa'),
  );
  const workboxBuild = createRequire(fromPlugin.resolve('workbox-build'));
  for (const [name, version] of listed) {
    const manifest = JSON.parse(
      await readFile(workboxBuild.resolve(`${name}/package.json`), 'utf8'),
    ) as { version: string };
    expect(version, name).toBe(manifest.version);
    // The runtime marker is not always bumped on a patch release (7.4.1 still
    // says 7.4.0): it must agree on the major and minor version.
    expect(version.split('.').slice(0, 2).join('.'), name).toBe(markers.get(name));
  }
});

test('S6: the service worker takes over by itself and cleans old caches', async ({ request }) => {
  const worker = await (await request.get(`${BASE_PATH}sw.js`)).text();
  expect(worker).toContain('skipWaiting');
  expect(worker).toContain('clientsClaim');
  expect(worker).toContain('cleanupOutdatedCaches');
  expect(worker).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
});

test('S7: deploy.yml has minimal permissions, no secret and pinned action versions', async () => {
  const workflow = (await readFile(resolve('.github/workflows/deploy.yml'), 'utf8')).replaceAll(
    '\r\n',
    '\n',
  );
  const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };

  // Workflow level: read the code, nothing more. The build job inherits it;
  // only the deploy job writes Pages and asks for an OIDC token.
  expect(permissionsBlock(workflow, '')).toEqual(['contents: read']);
  const buildJob = jobBlock(workflow, 'build');
  const deployJob = jobBlock(workflow, 'deploy');
  expect(buildJob).not.toMatch(/^\s*permissions:/m);
  expect(permissionsBlock(deployJob, ' {4}')).toEqual([
    'contents: read',
    'id-token: write',
    'pages: write',
  ]);
  expect(workflow).not.toMatch(/\bsecrets\./);
  expect(workflow).not.toContain('pull_request_target');
  expect(workflow).not.toMatch(/\bwrite-all\b|\bread-all\b/);

  // The checkout does not leave the token in .git/config; install scripts never run.
  expect(buildJob).toMatch(
    /uses: actions\/checkout@.*\n\s+with:\n(?:\s+#.*\n)*\s+persist-credentials: false\n/,
  );
  expect(workflow).toContain('run: npm ci --ignore-scripts\n');

  // Every action is pinned to a full commit SHA, the tag it stands for in a comment.
  const uses = [...workflow.matchAll(/uses:\s*(.+)$/gm)].map((match) => match[1] ?? '');
  expect(uses.length).toBeGreaterThanOrEqual(5);
  for (const action of uses) {
    expect(action, action).toMatch(/^[\w-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/);
  }

  // The checks run before the artifact is built, then the privacy, CSP and
  // offline specs play on that build before it is uploaded.
  const order = [
    'run: npm ci',
    'run: npm run lint',
    'run: npm run format:check',
    'run: npm run typecheck',
    'run: npm run test',
    'run: npm run test:scripts',
    'run: npm run build',
    'run: npx playwright install --with-deps chromium',
    'run: npx playwright test ',
    'uses: actions/upload-pages-artifact@',
  ];
  const positions = order.map((step) => workflow.indexOf(step));
  expect(positions.every((position) => position > -1)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  const specs = /run: npx playwright test (.+)$/m.exec(workflow)?.[1]?.split(' ') ?? [];
  expect(specs).toEqual(
    expect.arrayContaining([
      'e2e/f7-acceptance.spec.ts',
      'e2e/privacy.spec.ts',
      'e2e/offline.spec.ts',
    ]),
  );
  for (const script of ['lint', 'format:check', 'typecheck', 'test', 'test:scripts', 'build']) {
    expect(packageJson.scripts[script], script).toBeDefined();
  }
  expect(workflow).toContain('path: dist');

  // Dependabot proposes the updates of the pinned actions and of the npm packages.
  const dependabot = await readFile(resolve('.github/dependabot.yml'), 'utf8');
  for (const ecosystem of ['github-actions', 'npm']) {
    expect(dependabot).toContain(`package-ecosystem: ${ecosystem}`);
  }
});
