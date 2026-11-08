/**
 * End-to-end checks of the colour themes (scenario F6) on the built site: the
 * system setting followed on first load and live, the header selector
 * ("Système", "Encre sur papier", "Or sur noir"), the choice kept across a
 * reload and applied before the app starts (no flash), `localStorage` holding
 * the theme name and nothing else, WCAG AA contrast of every visible text
 * measured in the browser on the main screens of both themes, the tattoo
 * stencil kept in pure black on white, and no Content Security Policy
 * violation. Also checks that the copies of the theme colours (the second
 * "gold on black" block of `tokens.css`, the `theme-color` metadata of
 * `index.html`, `THEME_BACKGROUNDS` of `theme.ts`) never drift apart.
 */
import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Key documented in `src/app/theme.ts` and read by `public/theme-init.js`. */
const THEME_STORAGE_KEY = 'sigil.theme';

/** Intention of the F1 scenario. */
const INTENTION = 'Je suis calme';

/** Page backgrounds of the two themes, as computed by the browser. */
const PAGE_BACKGROUND = { light: 'rgb(243, 238, 227)', dark: 'rgb(15, 14, 12)' } as const;

/** WCAG 2.x AA minimum contrast for body text. */
const AA_TEXT = 4.5;

/** WCAG 2.x AA minimum contrast for large text (24 px, or 18.66 px bold). */
const AA_LARGE_TEXT = 3;

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
 * Picks a theme in the header. The radio is visually hidden: the click goes
 * to its label, as a user's would.
 *
 * @param page - Page on the app.
 * @param name - Name of the theme as announced in French.
 */
async function pickTheme(
  page: Page,
  name: 'Système' | 'Encre sur papier' | 'Or sur noir',
): Promise<void> {
  await page.getByTitle(name, { exact: true }).click();
  await expect(page.getByRole('radio', { name })).toBeChecked();
}

/**
 * Background colour of the page as painted.
 *
 * @param page - Page on the app.
 * @returns The computed background of `<html>`, as `rgb(…)`.
 */
async function pageBackground(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
}

/**
 * Every key and value of `localStorage`.
 *
 * @param page - Page to inspect.
 * @returns The stored entries as a plain object.
 */
async function localEntries(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(() =>
    Object.fromEntries(
      Array.from({ length: localStorage.length }, (_, index) => {
        const key = localStorage.key(index) ?? '';
        return [key, localStorage.getItem(key)];
      }),
    ),
  );
}

/**
 * Types the intention and presses "Tracer".
 *
 * @param page - Page on the app.
 */
async function trace(page: Page): Promise<void> {
  await page.getByLabel('Intention').fill(INTENTION);
  await page.getByRole('button', { name: 'Tracer', exact: true }).click();
  await expect(page.getByRole('img', { name: /^Sigil / })).toBeVisible();
}

/** One visible text whose contrast is below its AA threshold. */
interface ContrastFailure {
  readonly text: string;
  readonly ratio: number;
  readonly threshold: number;
  readonly color: string;
  readonly background: string;
}

/**
 * Measures, in the browser, the contrast of every visible piece of text of
 * the page (HTML text, not the sigil's SVG) against the background actually
 * behind it: the first opaque background among its ancestors, with the
 * translucent ones composited on top. Disabled controls are exempt (WCAG).
 *
 * @param page - Page on the app, in the state to check.
 * @returns How many texts were measured, and those below AA.
 */
async function contrastAudit(
  page: Page,
): Promise<{ measured: number; failures: ContrastFailure[] }> {
  return page.evaluate(
    ({ aaText, aaLarge }) => {
      type Rgba = [number, number, number, number];

      const parse = (value: string): Rgba | null => {
        const numbers = value.match(/[\d.]+/g)?.map(Number) ?? [];
        if (value.startsWith('rgb')) {
          const [r = 0, g = 0, b = 0, a = 1] = numbers;
          return [r, g, b, a];
        }
        if (value.startsWith('color(srgb')) {
          const [r = 0, g = 0, b = 0, a = 1] = numbers;
          return [r * 255, g * 255, b * 255, a];
        }
        return null;
      };
      const over = (top: Rgba, bottom: Rgba): Rgba => {
        const alpha = top[3];
        return [
          top[0] * alpha + bottom[0] * (1 - alpha),
          top[1] * alpha + bottom[1] * (1 - alpha),
          top[2] * alpha + bottom[2] * (1 - alpha),
          1,
        ];
      };
      const luminance = ([r, g, b]: Rgba): number => {
        const channel = (value: number) => {
          const c = value / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      const backgroundBehind = (element: Element): Rgba => {
        const layers: Rgba[] = [];
        for (let node: Element | null = element; node !== null; node = node.parentElement) {
          const colour = parse(getComputedStyle(node).backgroundColor);
          if (colour === null || colour[3] === 0) continue;
          layers.push(colour);
          if (colour[3] === 1) break;
        }
        const canvas: Rgba = parse(getComputedStyle(document.documentElement).backgroundColor) ?? [
          255, 255, 255, 1,
        ];
        return layers.reduceRight<Rgba>((below, layer) => over(layer, below), canvas);
      };
      const isVisible = (element: Element): boolean => {
        const box = element.getBoundingClientRect();
        if (box.width < 2 || box.height < 2) return false;
        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.opacity === '0') return false;
        // Visually hidden text (screen reader only) is clipped to nothing.
        return !style.clipPath.includes('inset(50%)');
      };
      const isDisabled = (element: Element): boolean =>
        element.closest('[aria-disabled="true"], :disabled, label:has(:disabled)') !== null;

      const failures: ContrastFailure[] = [];
      let measured = 0;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const element = node.parentElement;
        const text = node.textContent?.trim() ?? '';
        if (element === null || text === '' || element.closest('svg') !== null) continue;
        if (!isVisible(element) || isDisabled(element)) continue;
        const style = getComputedStyle(element);
        const colour = parse(style.color);
        if (colour === null) continue;
        const background = backgroundBehind(element);
        const foreground = over(colour, background);
        const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
          (a, b) => b - a,
        ) as [number, number];
        const ratio = (lighter + 0.05) / (darker + 0.05);
        const size = Number.parseFloat(style.fontSize);
        const bold = Number(style.fontWeight) >= 700;
        const threshold = size >= 24 || (bold && size >= 18.66) ? aaLarge : aaText;
        measured += 1;
        if (ratio < threshold) {
          failures.push({
            text: text.slice(0, 40),
            ratio: Math.round(ratio * 100) / 100,
            threshold,
            color: style.color,
            background: `rgb(${background.slice(0, 3).map(Math.round).join(', ')})`,
          });
        }
      }
      return { measured, failures };
    },
    { aaText: AA_TEXT, aaLarge: AA_LARGE_TEXT },
  );
}

test.describe('first load', () => {
  test('follows the system scheme, live, with nothing stored', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('./');

    await expect(page.getByRole('radio', { name: 'Système' })).toBeChecked();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    expect(await pageBackground(page)).toBe(PAGE_BACKGROUND.dark);

    await page.emulateMedia({ colorScheme: 'light' });
    expect(await pageBackground(page)).toBe(PAGE_BACKGROUND.light);
    expect(await localEntries(page)).toEqual({});
  });

  test('sits in the header, after the language, before the intention in Tab order', async ({
    page,
  }) => {
    await page.goto('./');

    await expect(page.locator('header').getByRole('group', { name: 'Thème' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'Français' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'Système' })).toBeFocused();
    // Arrows move the choice inside the group, as with any radio group.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Encre sur papier' })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Intention')).toBeFocused();
  });
});

test.describe('explicit choice', () => {
  test('switches theme against the system, keeps the sigil, and survives a reload', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await watchCsp(page);
    await page.goto('./');
    await trace(page);

    await pickTheme(page, 'Or sur noir');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await pageBackground(page)).toBe(PAGE_BACKGROUND.dark);
    await expect(page.getByLabel('Intention')).toHaveValue(INTENTION);
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
      'content',
      '#0f0e0c',
    );

    await page.reload();

    await expect(page.getByRole('radio', { name: 'Or sur noir' })).toBeChecked();
    expect(await pageBackground(page)).toBe(PAGE_BACKGROUND.dark);

    await page.emulateMedia({ colorScheme: 'dark' });
    await pickTheme(page, 'Encre sur papier');
    expect(await pageBackground(page)).toBe(PAGE_BACKGROUND.light);
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Encre sur papier' })).toBeChecked();
    expect(await pageBackground(page)).toBe(PAGE_BACKGROUND.light);
    expect(await cspViolations(page)).toEqual([]);
  });

  test.describe('before the app starts', () => {
    // A service worker would serve the bundle from its cache, out of reach of
    // page.route(): it is blocked so that the bundle can really be withheld.
    test.use({ serviceWorkers: 'block' });

    test('applies the stored theme before the app starts (no flash of the other theme)', async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('./');
      await pickTheme(page, 'Or sur noir');

      // Without the app bundle, only the start-up script can have set the theme.
      await page.route(/\/assets\/index-[^/]+\.js$/, (route) => route.abort());
      await page.reload();

      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(page.locator('#root')).toBeEmpty();
      expect(await pageBackground(page)).toBe(PAGE_BACKGROUND.dark);
    });
  });

  test('stores the theme name only, nothing for the system, and ignores invalid values', async ({
    page,
  }) => {
    await page.goto('./');
    await page.getByLabel('Intention').fill(INTENTION);

    await pickTheme(page, 'Or sur noir');
    expect(await localEntries(page)).toEqual({ [THEME_STORAGE_KEY]: 'dark' });
    await pickTheme(page, 'Encre sur papier');
    expect(await localEntries(page)).toEqual({ [THEME_STORAGE_KEY]: 'light' });
    await pickTheme(page, 'Système');
    expect(await localEntries(page)).toEqual({});
    expect(JSON.stringify(await localEntries(page))).not.toContain(INTENTION);

    await page.evaluate((key) => {
      localStorage.setItem(key, 'sepia');
    }, THEME_STORAGE_KEY);
    await page.reload();

    await expect(page.getByRole('radio', { name: 'Système' })).toBeChecked();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  });
});

for (const theme of ['Or sur noir', 'Encre sur papier'] as const) {
  test(`every visible text meets WCAG AA on the main screens, theme "${theme}" (F6)`, async ({
    page,
  }) => {
    // No transition or tracing in flight: colours are measured in their final state.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    await pickTheme(page, theme);
    const audits: Record<string, Awaited<ReturnType<typeof contrastAudit>>> = {};

    audits.empty = await contrastAudit(page);

    await page.getByRole('button', { name: 'Tracer', exact: true }).click();
    await expect(page.getByText(/Écrivez une intention avant de tracer/)).toBeVisible();
    audits.error = await contrastAudit(page);

    await page.getByLabel('Intention').fill('Je suis calme 2');
    await page.getByRole('button', { name: 'Tracer', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Sigil kamea de Saturne' })).toBeVisible();
    audits.kamea = await contrastAudit(page);

    await page.getByText('Spare', { exact: true }).click();
    await page.getByRole('button', { name: 'Tracer', exact: true }).click();
    await expect(page.getByRole('img', { name: /^Sigil de Spare/ })).toBeVisible();
    audits.spare = await contrastAudit(page);

    await page.getByRole('button', { name: 'Exporter' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    audits.exportDialog = await contrastAudit(page);

    for (const [screen, audit] of Object.entries(audits)) {
      expect(audit.measured, `${screen}: texts measured`).toBeGreaterThan(10);
      expect(audit.failures, `${screen}: texts below AA`).toEqual([]);
    }
  });
}

test('keeps the tattoo stencil in pure black on white on the gold theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  await pickTheme(page, 'Or sur noir');
  await trace(page);
  const styleSummary = page.locator('summary', { hasText: 'Style' });
  if ((await styleSummary.locator('xpath=..').getAttribute('open')) === null) {
    await styleSummary.click();
  }

  await page.getByRole('switch', { name: 'Pochoir tatouage' }).check({ force: true });

  const sigil = page.getByRole('img', { name: /^Sigil kamea/ });
  const colours = await sigil.evaluate((svg) => ({
    strokes: Array.from(
      svg.querySelectorAll('path, circle, line'),
      (element) => getComputedStyle(element).stroke,
    ),
    stage: getComputedStyle(svg.parentElement ?? svg).backgroundColor,
  }));
  expect(new Set(colours.strokes)).toEqual(new Set(['rgb(0, 0, 0)']));
  expect(colours.stage).toBe('rgb(255, 255, 255)');
  expect(await pageBackground(page)).toBe(PAGE_BACKGROUND.dark);
});

test('keeps every copy of the theme colours identical to the tokens', async () => {
  const [tokens, indexHtml, themeModule] = await Promise.all(
    ['src/styles/tokens.css', 'index.html', 'src/app/theme.ts'].map((path) =>
      readFile(path, 'utf8'),
    ),
  );
  const css = (tokens ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
  /**
   * Custom property declarations of the first rule with that exact selector.
   *
   * @param selector - Selector text as written in tokens.css.
   * @returns Declarations as `name: value`, whitespace normalised, in source order.
   */
  const declarationsOf = (selector: string): string[] => {
    const start = css.indexOf(`${selector} {`);
    expect(start, `rule ${selector} in tokens.css`).toBeGreaterThanOrEqual(0);
    return css
      .slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
      .split(';')
      .map((declaration) => declaration.trim().replace(/\s+/g, ' '))
      .filter((declaration) => declaration !== '');
  };
  const background = (selector: string) =>
    declarationsOf(selector)
      .find((declaration) => declaration.startsWith('--color-bg: '))
      ?.slice('--color-bg: '.length);

  const explicitDark = declarationsOf(':root[data-theme="dark"]');
  expect(explicitDark.length).toBeGreaterThan(10);
  expect(declarationsOf(':root:not([data-theme])')).toEqual(explicitDark);
  expect(explicitDark.some((declaration) => declaration.startsWith('--color-backdrop: '))).toBe(
    true,
  );

  const light = background(':root');
  const dark = background(':root[data-theme="dark"]');
  expect(indexHtml).toContain(
    `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${String(light)}" />`,
  );
  expect(indexHtml).toContain(
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${String(dark)}" />`,
  );
  expect(themeModule).toContain(`light: '${String(light)}'`);
  expect(themeModule).toContain(`dark: '${String(dark)}'`);
});
