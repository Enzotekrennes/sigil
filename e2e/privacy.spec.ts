/**
 * End-to-end checks of the privacy guarantees: the page never contacts another
 * origin, declares its Content Security Policy and referrer policy in
 * `<meta>` elements (GitHub Pages cannot send headers), and the browser
 * actually enforces that policy.
 */
import { expect, test, type Page } from '@playwright/test';

import { waitForServiceWorkerControl } from './service-worker.ts';

/** URL schemes that stay inside the browser and never reach the network. */
const LOCAL_SCHEMES = new Set(['data:', 'blob:']);

/**
 * Reads the Content-Security-Policy `<meta>` of the page as a directive map.
 *
 * @param page - A page already navigated to the app.
 * @returns Each directive name mapped to its source list.
 * @throws {Error} When the page has no policy `<meta>`.
 */
async function readCspDirectives(page: Page): Promise<Map<string, string[]>> {
  const content = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  if (content === null) throw new Error('No Content-Security-Policy <meta> in the page.');

  const directives = new Map<string, string[]>();
  for (const directive of content.split(';')) {
    const [name, ...sources] = directive.trim().split(/\s+/);
    if (name) directives.set(name, sources);
  }
  return directives;
}

test('loading and navigating never contacts another origin', async ({ page, context, baseURL }) => {
  const siteOrigin = new URL(baseURL ?? '').origin;
  const foreignRequests: string[] = [];
  // Context-level events also report the service worker's own requests.
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (LOCAL_SCHEMES.has(url.protocol)) return;
    if (url.origin !== siteOrigin) foreignRequests.push(request.url());
  });

  await page.goto('./');
  await waitForServiceWorkerControl(page);
  await page.reload();
  await page.goto('./index.html');
  await expect(page.getByRole('heading', { level: 1, name: 'Sigil' })).toBeVisible();

  expect(foreignRequests).toEqual([]);
});

test('the page declares a strict CSP and no referrer', async ({ page }) => {
  await page.goto('./');

  const directives = await readCspDirectives(page);
  expect(directives.get('default-src')).toEqual(["'self'"]);
  expect(directives.get('script-src')).toEqual(["'self'"]);
  expect(directives.get('style-src')).toEqual(["'self'"]);
  expect(directives.get('connect-src')).toEqual(["'self'"]);
  expect(directives.get('img-src')).toEqual(["'self'", 'data:', 'blob:']);
  expect(directives.get('worker-src')).toEqual(["'self'"]);
  expect(directives.get('manifest-src')).toEqual(["'self'"]);
  expect(directives.get('object-src')).toEqual(["'none'"]);
  expect(directives.get('form-action')).toEqual(["'none'"]);
  const allSources = [...directives.values()].flat();
  expect(allSources).not.toContain("'unsafe-inline'");
  expect(allSources).not.toContain("'unsafe-eval'");

  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
});

test('the browser enforces the CSP: no inline script, no markup style, CSSOM styles allowed', async ({
  page,
}) => {
  await page.goto('./');

  const outcome = await page.evaluate(async () => {
    const violations: string[] = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(event.effectiveDirective);
    });

    const script = document.createElement('script');
    script.textContent = 'document.documentElement.dataset.inlineScriptRan = "yes";';
    document.body.append(script);

    // Markup style attribute: what 'unsafe-inline' would allow.
    const markupStyled = document.createElement('div');
    markupStyled.setAttribute('style', 'width: 123px');
    document.body.append(markupStyled);

    // CSSOM style: how React applies the `style` prop.
    const cssomStyled = document.createElement('div');
    cssomStyled.style.width = '77px';
    cssomStyled.style.setProperty('--sigil-test-length', '5');
    document.body.append(cssomStyled);

    // Violation events are dispatched asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      inlineScriptRan: document.documentElement.dataset.inlineScriptRan === 'yes',
      markupWidth: getComputedStyle(markupStyled).width,
      cssomWidth: getComputedStyle(cssomStyled).width,
      cssomCustomProperty: getComputedStyle(cssomStyled).getPropertyValue('--sigil-test-length'),
      violations,
    };
  });

  expect(outcome.inlineScriptRan).toBe(false);
  expect(outcome.markupWidth).not.toBe('123px');
  expect(outcome.cssomWidth).toBe('77px');
  expect(outcome.cssomCustomProperty).toBe('5');
  expect(outcome.violations).toEqual(expect.arrayContaining(['script-src-elem', 'style-src-attr']));
});
