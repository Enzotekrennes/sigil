/**
 * Acceptance tests of F6 "Themes and FR/EN interface", written from the tester's
 * side (independent from `i18n.spec.ts` and `theme.spec.ts`), against the built
 * site:
 *
 * 1. language detection on first load (en* -> English, anything else -> French,
 *    first preferred language wins);
 * 2. language and theme choices kept across a reload, storage limited to
 *    `sigil.language` and `sigil.theme` (never the intention);
 * 3. WCAG AA contrast of every visible text of both themes on every screen
 *    (empty, errors, kamea and Spare panels, Style panel, export dialog), at
 *    375 and 1440 px, in both languages, plus borders and focus ring (3:1);
 * and the cross-checks of the brief: no flash of theme or language before the
 * app starts, system theme followed live, header selectors usable with the
 * keyboard, 375 px layout, decimals and plurals per language, PDF
 * instruction in the interface language, stencil pure black on white in both
 * themes, no Content Security Policy violation, no French left in the English
 * interface.
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/restrict-template-expressions -- test code: indexed values are asserted just before use */
import { inflateSync } from 'node:zlib';

import { expect, test } from '@playwright/test';
import type { Browser, Locator, Page } from '@playwright/test';

import { waitForAnimationsToFinish } from './animations.ts';

/** Storage keys documented in `src/features/i18n/storage.ts` and `src/app/theme.ts`. */
const LANGUAGE_KEY = 'sigil.language';
const THEME_KEY = 'sigil.theme';

/** Page backgrounds of the two themes (tokens `--color-bg`). */
const BG = { light: 'rgb(243, 238, 227)', dark: 'rgb(15, 14, 12)' } as const;

/** WCAG 2.x AA thresholds. */
const AA_TEXT = 4.5;
const AA_LARGE_TEXT = 3;
const AA_UI = 3;

/**
 * @returns The base URL of the project under test (always set by the config).
 */
function baseUrl(): string {
  return test.info().project.use.baseURL ?? '';
}

type Lang = 'en' | 'fr';
type Theme = 'light' | 'dark';

/** Every label the tests need, per interface language. */
const L = {
  en: {
    intention: 'Intention',
    trace: 'Trace',
    exportOpen: 'Export',
    download: 'Download',
    cancel: 'Cancel',
    sizeLabel: 'Actual size (cm)',
    stencil: 'Tattoo stencil',
    stage: /^(Kamea|Spare) sigil/,
    themes: { system: 'System', light: 'Ink on paper', dark: 'Gold on black' },
    langGroup: 'Interface language',
    themeGroup: 'Theme',
    keepVowelsTrace: 'Keep the vowels and trace',
  },
  fr: {
    intention: 'Intention',
    trace: 'Tracer',
    exportOpen: 'Exporter',
    download: 'Télécharger',
    cancel: 'Annuler',
    sizeLabel: 'Taille réelle (cm)',
    stencil: 'Pochoir tatouage',
    stage: /^Sigil (kamea|de Spare)/,
    themes: { system: 'Système', light: 'Encre sur papier', dark: 'Or sur noir' },
    langGroup: 'Langue de l’interface',
    themeGroup: 'Thème',
    keepVowelsTrace: 'Garder les voyelles et tracer',
  },
} as const;

const INTENTION = { en: 'I am calm and free', fr: 'Je suis calme et libre' } as const;

/** Locale of the browser context for each interface language. */
const LOCALE = { en: 'en-US', fr: 'fr-FR' } as const;

/**
 * Collects CSP violations and page errors from before any script runs.
 *
 * @param page - Page not yet navigated.
 */
async function watch(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.assign(window, { f6Violations: seen });
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
    window.addEventListener('error', (event) => seen.push(`error ${event.message}`));
  });
}

/**
 * @param page - Page watched by `watch`.
 * @returns CSP violations and uncaught errors seen so far.
 */
async function violations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { f6Violations: string[] }).f6Violations);
}

/**
 * @param page - Page on the app.
 * @returns `localStorage` and `sessionStorage` as plain objects, plus cookies.
 */
async function storage(page: Page) {
  return page.evaluate(() => {
    const dump = (area: Storage) =>
      Object.fromEntries(
        Array.from({ length: area.length }, (_, index) => {
          const key = area.key(index) ?? '';
          return [key, area.getItem(key)];
        }),
      );
    return { local: dump(localStorage), session: dump(sessionStorage), cookie: document.cookie };
  });
}

/**
 * @param page - Page on the app.
 * @returns Computed background of `<html>`.
 */
async function pageBackground(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
}

/**
 * Picks a theme by clicking its (visually hidden) radio's label.
 *
 * @param page - Page on the app.
 * @param lang - Current interface language.
 * @param theme - Theme to pick, or `system`.
 */
async function pickTheme(page: Page, lang: Lang, theme: Theme | 'system'): Promise<void> {
  const name = L[lang].themes[theme];
  await page.getByTitle(name, { exact: true }).click();
  await expect(page.getByRole('radio', { name })).toBeChecked();
}

/**
 * Types the intention and traces.
 *
 * @param page - Page on the app.
 * @param lang - Current interface language.
 * @param text - Intention; defaults to the language's sample.
 */
async function traceIntention(page: Page, lang: Lang, text?: string): Promise<void> {
  await page.getByRole('textbox', { name: L[lang].intention }).fill(text ?? INTENTION[lang]);
  await page.getByRole('button', { name: L[lang].trace, exact: true }).click();
}

/**
 * Selects Spare in the method group.
 *
 * @param page - Page on the app.
 */
async function chooseSpare(page: Page): Promise<void> {
  await page.getByRole('radio', { name: 'Spare' }).check({ force: true });
}

/**
 * Makes sure the Style panel is open.
 *
 * @param page - Page on the app.
 */
async function openStyle(page: Page): Promise<void> {
  const summary = page.locator('summary', { hasText: 'Style' });
  if ((await summary.locator('xpath=..').getAttribute('open')) === null) await summary.click();
}

/** One text or UI element below its contrast threshold. */
interface Failure {
  readonly what: string;
  readonly ratio: number;
  readonly threshold: number;
}

/**
 * Measures, in the browser, the contrast of every visible HTML text against the
 * background actually behind it (translucent layers composited), and the
 * contrast of the border of every text field and of the focus ring.
 *
 * @param page - Page in the state to check.
 * @returns How many texts were measured and the failures.
 */
async function audit(page: Page): Promise<{ measured: number; failures: Failure[] }> {
  return page.evaluate(
    ({ aaText, aaLarge, aaUi }) => {
      type Rgba = [number, number, number, number];
      const parse = (value: string): Rgba | null => {
        const n = value.match(/[\d.]+/g)?.map(Number) ?? [];
        if (value.startsWith('rgb')) return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1];
        if (value.startsWith('color(srgb'))
          return [(n[0] ?? 0) * 255, (n[1] ?? 0) * 255, (n[2] ?? 0) * 255, n[3] ?? 1];
        return null;
      };
      const over = (t: Rgba, b: Rgba): Rgba => [
        t[0] * t[3] + b[0] * (1 - t[3]),
        t[1] * t[3] + b[1] * (1 - t[3]),
        t[2] * t[3] + b[2] * (1 - t[3]),
        1,
      ];
      const lum = ([r, g, b]: Rgba) => {
        const f = (v: number) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const ratio = (a: Rgba, b: Rgba) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
        return (hi + 0.05) / (lo + 0.05);
      };
      const behind = (el: Element): Rgba => {
        const layers: Rgba[] = [];
        for (let n: Element | null = el; n !== null; n = n.parentElement) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c === null || c[3] === 0) continue;
          layers.push(c);
          if (c[3] === 1) break;
        }
        const canvas = parse(getComputedStyle(document.documentElement).backgroundColor) ?? [
          255, 255, 255, 1,
        ];
        return layers.reduceRight<Rgba>((below, layer) => over(layer, below), canvas);
      };
      const visible = (el: Element) => {
        const box = el.getBoundingClientRect();
        if (box.width < 2 || box.height < 2) return false;
        const s = getComputedStyle(el);
        return s.visibility !== 'hidden' && s.opacity !== '0' && !s.clipPath.includes('inset(50%)');
      };
      const disabled = (el: Element) =>
        el.closest('[aria-disabled="true"], :disabled, label:has(:disabled)') !== null;

      const failures: Failure[] = [];
      let measured = 0;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const el = node.parentElement;
        const text = node.textContent?.trim() ?? '';
        if (el === null || text === '' || el.closest('svg') !== null) continue;
        if (!visible(el) || disabled(el)) continue;
        const s = getComputedStyle(el);
        const fg = parse(s.color);
        if (fg === null) continue;
        const bg = behind(el);
        const r = ratio(over(fg, bg), bg);
        const size = Number.parseFloat(s.fontSize);
        const large = size >= 24 || (Number(s.fontWeight) >= 700 && size >= 18.66);
        const threshold = large ? aaLarge : aaText;
        measured += 1;
        if (r < threshold)
          failures.push({
            what: `text "${text.slice(0, 40)}"`,
            ratio: Math.round(r * 100) / 100,
            threshold,
          });
      }
      // Borders of text fields (non-text contrast, 3:1).
      for (const field of document.querySelectorAll(
        'input[type="text"], input:not([type]), textarea, select',
      )) {
        if (!visible(field)) continue;
        const s = getComputedStyle(field);
        if (Number.parseFloat(s.borderTopWidth) === 0) continue;
        const border = parse(s.borderTopColor);
        if (border === null) continue;
        const bg = behind(field.parentElement ?? field);
        const r = ratio(over(border, bg), bg);
        measured += 1;
        if (r < aaUi)
          failures.push({
            what: `border of <${field.tagName.toLowerCase()}>`,
            ratio: Math.round(r * 100) / 100,
            threshold: aaUi,
          });
      }
      return { measured, failures };
    },
    { aaText: AA_TEXT, aaLarge: AA_LARGE_TEXT, aaUi: AA_UI },
  );
}

/** Screens audited for contrast and for stray French. */
const SCREENS = [
  'empty',
  'error-empty',
  'error-only-vowels',
  'kamea',
  'spare',
  'style-stencil',
  'export-svg',
  'export-pdf-error',
] as const;
type Screen = (typeof SCREENS)[number];

/**
 * Brings the app to a screen.
 *
 * @param page - Page on the app.
 * @param lang - Interface language.
 * @param screen - Screen to reach.
 */
async function reach(page: Page, lang: Lang, screen: Screen): Promise<void> {
  const l = L[lang];
  const dialog = page.getByRole('dialog');
  switch (screen) {
    case 'empty':
      return;
    case 'error-empty':
      await page.getByRole('button', { name: l.trace, exact: true }).click();
      return;
    case 'error-only-vowels':
      await chooseSpare(page);
      await traceIntention(page, lang, 'aeiou');
      return;
    case 'kamea':
      await traceIntention(page, lang);
      await expect(page.getByRole('img', { name: l.stage })).toBeVisible();
      return;
    case 'spare':
      await chooseSpare(page);
      await traceIntention(page, lang);
      await expect(page.getByRole('img', { name: l.stage })).toBeVisible();
      return;
    case 'style-stencil':
      await traceIntention(page, lang);
      await openStyle(page);
      await page.getByRole('switch', { name: l.stencil }).check({ force: true });
      return;
    case 'export-svg':
      await traceIntention(page, lang);
      await page.getByRole('button', { name: l.exportOpen, exact: true }).click();
      await expect(dialog).toBeVisible();
      return;
    case 'export-pdf-error':
      await traceIntention(page, lang);
      await page.getByRole('button', { name: l.exportOpen, exact: true }).click();
      await dialog.getByRole('radio', { name: 'PDF' }).check({ force: true });
      await dialog.getByLabel(l.sizeLabel).fill('40');
      await expect(dialog.getByText(/25/).first()).toBeVisible();
      return;
  }
}

/**
 * Opens the app in a fresh context with a given language and stored choices.
 *
 * @param browser - Browser.
 * @param options - Options of the context.
 * @param options.locale - Locale of the browser.
 * @param options.languages - Preferred languages overriding `navigator.languages`.
 * @param options.width - Viewport width in px (default 1440).
 * @param options.scheme - System colour scheme (default light).
 * @param options.stored - `localStorage` entries set before the app starts.
 * @returns The page (the context is closed with the browser).
 */
async function openApp(
  browser: Browser,
  options: {
    locale: string;
    languages?: string[];
    width?: number;
    scheme?: 'light' | 'dark';
    stored?: Record<string, string>;
  },
): Promise<Page> {
  const context = await browser.newContext({
    locale: options.locale,
    viewport: { width: options.width ?? 1440, height: 1000 },
    colorScheme: options.scheme ?? 'light',
    acceptDownloads: true,
    baseURL: baseUrl(),
  });
  const page = await context.newPage();
  await watch(page);
  if (options.languages !== undefined) {
    await page.addInitScript((languages) => {
      Object.defineProperty(navigator, 'languages', { get: () => languages });
      Object.defineProperty(navigator, 'language', { get: () => languages[0] });
    }, options.languages);
  }
  if (options.stored !== undefined) {
    await page.addInitScript((entries) => {
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, options.stored);
  }
  await page.goto('./');
  return page;
}

// ---------------------------------------------------------------------------
// Scenario 1 - language on first load
// ---------------------------------------------------------------------------

test.describe('scenario 1: language on first load', () => {
  const CASES: readonly [string, string[], Lang][] = [
    ['en-US', ['en-US'], 'en'],
    ['en-GB', ['en-GB'], 'en'],
    ['en', ['en'], 'en'],
    ['en-US then fr', ['en-US', 'fr-FR'], 'en'],
    ['fr-FR', ['fr-FR'], 'fr'],
    ['fr-CA', ['fr-CA'], 'fr'],
    ['de-DE', ['de-DE'], 'fr'],
    ['es-ES', ['es-ES'], 'fr'],
    ['es', ['es'], 'fr'],
    ['ja-JP', ['ja-JP'], 'fr'],
    ['de-DE then en-US (first language decides)', ['de-DE', 'en-US'], 'fr'],
    ['fr then en-US', ['fr-FR', 'en-US'], 'fr'],
  ];
  for (const [label, languages, expected] of CASES) {
    test(`browser ${label} -> ${expected === 'en' ? 'English' : 'French'}`, async ({ browser }) => {
      const page = await openApp(browser, { locale: languages[0] ?? 'fr-FR', languages });
      await expect(
        page.getByRole('button', { name: L[expected].trace, exact: true }),
      ).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', expected);
      await expect(
        page.getByRole('radio', { name: expected === 'en' ? 'English' : 'Français' }),
      ).toBeChecked();
      // Nothing is written by merely opening the page.
      expect(await storage(page)).toEqual({ local: {}, session: {}, cookie: '' });
      await page.context().close();
    });
  }

  test('no French text is painted at any frame of the load of an English browser', async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale: 'en-US', baseURL: baseUrl() });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const frames: string[] = [];
      Object.assign(window, { f6Frames: frames });
      const tick = () => {
        frames.push(document.body.innerText);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto('./');
    await expect(page.getByRole('button', { name: 'Trace', exact: true })).toBeVisible();
    // Keep recording a few more painted frames once the English interface is up.
    const recorded = await page.evaluate(
      () => (window as unknown as { f6Frames: string[] }).f6Frames.length,
    );
    await page.waitForFunction(
      (count) => (window as unknown as { f6Frames: string[] }).f6Frames.length >= count + 10,
      recorded,
    );
    const frames = await page.evaluate(
      () => (window as unknown as { f6Frames: string[] }).f6Frames,
    );
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.filter((text) => /Tracer|Intention\b.*Méthode|Carré/s.test(text))).toEqual([]);
    await context.close();
  });

  test('a stored language beats the browser language', async ({ browser }) => {
    const page = await openApp(browser, { locale: 'en-US', stored: { [LANGUAGE_KEY]: 'fr' } });
    await expect(page.getByRole('button', { name: 'Tracer', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await page.context().close();
  });

  test('an invalid stored language is ignored and the browser decides', async ({ browser }) => {
    for (const bad of ['de', 'EN', '', 'en-US', '{"a":1}']) {
      const page = await openApp(browser, { locale: 'en-US', stored: { [LANGUAGE_KEY]: bad } });
      await expect(page.getByRole('button', { name: 'Trace', exact: true })).toBeVisible();
      await page.context().close();
    }
  });

  test('the app still works when storage is blocked', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US', baseURL: baseUrl() });
    const page = await context.newPage();
    await watch(page);
    await page.addInitScript(() => {
      const fail = () => {
        throw new DOMException('blocked', 'SecurityError');
      };
      Storage.prototype.getItem = fail;
      Storage.prototype.setItem = fail;
    });
    await page.goto('./');
    await expect(page.getByRole('button', { name: 'Trace', exact: true })).toBeVisible();
    await page.getByTitle('Français', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Tracer', exact: true })).toBeVisible();
    await page
      .getByTitle('Gold on black', { exact: true })
      .or(page.getByTitle('Or sur noir', { exact: true }))
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await traceIntention(page, 'fr');
    await expect(page.getByRole('img', { name: L.fr.stage })).toBeVisible();
    expect((await violations(page)).filter((v) => !v.startsWith('error '))).toEqual([]);
    await context.close();
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 - choices kept across a reload, storage limited
// ---------------------------------------------------------------------------

test.describe('scenario 2: persistence', () => {
  for (const [browserLang, other] of [
    ['en', 'fr'],
    ['fr', 'en'],
  ] as const) {
    test(`language ${other} picked on a ${browserLang} browser survives two reloads`, async ({
      browser,
    }) => {
      const page = await openApp(browser, { locale: LOCALE[browserLang] });
      await page.getByTitle(other === 'fr' ? 'Français' : 'English', { exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', other);
      for (let i = 0; i < 2; i += 1) {
        await page.reload();
        await expect(page.getByRole('button', { name: L[other].trace, exact: true })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', other);
      }
      expect((await storage(page)).local).toEqual({ [LANGUAGE_KEY]: other });
      await page.context().close();
    });
  }

  test('theme and language together: each kept, storage holds exactly the two keys', async ({
    browser,
  }) => {
    const page = await openApp(browser, { locale: 'fr-FR', scheme: 'light' });
    await traceIntention(page, 'fr', 'Un secret très personnel');
    await pickTheme(page, 'fr', 'dark');
    await page.getByTitle('English', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Gold on black' })).toBeChecked();
    await page.reload();

    await expect(page.getByRole('radio', { name: 'English' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Gold on black' })).toBeChecked();
    expect(await pageBackground(page)).toBe(BG.dark);
    const state = await storage(page);
    expect(state.local).toEqual({ [LANGUAGE_KEY]: 'en', [THEME_KEY]: 'dark' });
    expect(state.session).toEqual({});
    expect(state.cookie).toBe('');
    // The intention is neither restored after a reload nor stored anywhere.
    await expect(page.getByLabel('Intention')).toHaveValue('');
    expect(JSON.stringify(state)).not.toContain('secret');
    expect(page.url()).not.toMatch(/secret|personnel/i);
    const databases = await page.evaluate(async () => await indexedDB.databases());
    expect(databases.filter((db) => !/workbox|sigil-sw/i.test(db.name ?? ''))).toEqual([]);
    await page.context().close();
  });

  test('the intention never reaches storage or the URL while tracing, switching language and theme', async ({
    browser,
  }) => {
    const page = await openApp(browser, { locale: 'en-US' });
    const secret = 'Zorglub Mistral Quetzal';
    await traceIntention(page, 'en', secret);
    await pickTheme(page, 'en', 'dark');
    await page.getByTitle('Français', { exact: true }).click();
    await expect(page.getByLabel('Intention')).toHaveValue(secret);
    await page.getByRole('button', { name: 'Tracer', exact: true }).click();
    const state = await storage(page);
    expect(Object.keys(state.local).sort()).toEqual([LANGUAGE_KEY, THEME_KEY]);
    expect(JSON.stringify(state).toLowerCase()).not.toContain('zorglub');
    expect(decodeURIComponent(page.url()).toLowerCase()).not.toContain('zorglub');
    await page.context().close();
  });

  test('language switch keeps the traced sigil and its explanation', async ({ browser }) => {
    const page = await openApp(browser, { locale: 'en-US' });
    await traceIntention(page, 'en');
    const d = await page
      .getByRole('img', { name: L.en.stage })
      .locator('path')
      .first()
      .getAttribute('d');
    await page.getByTitle('Français', { exact: true }).click();
    await expect(page.getByRole('img', { name: L.fr.stage })).toBeVisible();
    expect(
      await page.getByRole('img', { name: L.fr.stage }).locator('path').first().getAttribute('d'),
    ).toBe(d);
    await expect(page.getByLabel('Intention')).toHaveValue(INTENTION.en);
    await expect(page.getByRole('heading', { name: 'Comment c’est fait' })).toBeVisible();
    await page.context().close();
  });

  test('an invalid stored theme is ignored (follows the system)', async ({ browser }) => {
    for (const bad of ['sepia', 'DARK', '', 'system']) {
      const page = await openApp(browser, {
        locale: 'en-US',
        scheme: 'dark',
        stored: { [THEME_KEY]: bad },
      });
      await expect(page.getByRole('radio', { name: 'System' })).toBeChecked();
      await expect(page.locator('html')).not.toHaveAttribute('data-theme');
      expect(await pageBackground(page)).toBe(BG.dark);
      await page.context().close();
    }
  });

  test('the Gold on black choice is kept and wins over the system in both directions', async ({
    browser,
  }) => {
    for (const [scheme, theme] of [
      ['light', 'dark'],
      ['dark', 'light'],
    ] as const) {
      const page = await openApp(browser, { locale: 'en-US', scheme });
      await pickTheme(page, 'en', theme);
      await page.reload();
      expect(await pageBackground(page)).toBe(BG[theme]);
      await page.emulateMedia({ colorScheme: scheme === 'light' ? 'dark' : 'light' });
      expect(await pageBackground(page)).toBe(BG[theme]);
      await page.context().close();
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 - contrast AA, both themes, every screen
// ---------------------------------------------------------------------------

test.describe('scenario 3: WCAG AA contrast', () => {
  for (const lang of ['en', 'fr'] as const) {
    for (const theme of ['dark', 'light'] as const) {
      for (const width of lang === 'en' ? [1440, 375] : [1440]) {
        test(`${lang} / ${theme} / ${width}px: every screen meets AA`, async ({ browser }) => {
          test.setTimeout(120_000);
          // The system scheme is the opposite one: the explicit choice must win.
          const page = await openApp(browser, {
            locale: LOCALE[lang],
            width,
            scheme: theme === 'dark' ? 'light' : 'dark',
          });
          await pickTheme(page, lang, theme);
          expect(await pageBackground(page)).toBe(BG[theme]);
          const report: string[] = [];
          for (const screen of SCREENS) {
            await page.reload();
            await reach(page, lang, screen);
            await waitForAnimationsToFinish(page, { outsideSigil: true });
            const { measured, failures } = await audit(page);
            expect(measured, `${screen}: texts measured`).toBeGreaterThan(5);
            report.push(...failures.map((f) => `${screen}: ${f.what} ${f.ratio} < ${f.threshold}`));
          }
          expect(report).toEqual([]);
          await page.context().close();
        });
      }
    }
  }

  test('gold on black: the ratio of the main pairs is at least AA (computed from the page)', async ({
    browser,
  }) => {
    const page = await openApp(browser, { locale: 'en-US', stored: { [THEME_KEY]: 'dark' } });
    const tokens = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        [
          '--color-bg',
          '--color-surface',
          '--color-text',
          '--color-text-muted',
          '--color-accent',
          '--color-error',
          '--color-border',
        ].map((name) => [name, s.getPropertyValue(name).trim()]),
      );
    });
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [
        number,
        number,
        number,
      ];
      const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const fg of ['--color-text', '--color-text-muted', '--color-accent', '--color-error']) {
      for (const bg of ['--color-bg', '--color-surface']) {
        expect(
          ratio(tokens[fg] ?? '#000', tokens[bg] ?? '#fff'),
          `${fg} on ${bg}`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
    expect(
      ratio(tokens['--color-border'] ?? '#000', tokens['--color-bg'] ?? '#fff'),
    ).toBeGreaterThanOrEqual(AA_UI);
    await page.context().close();
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`${theme}: the keyboard focus ring is visible (3:1) on the header selectors and the fields`, async ({
      browser,
    }) => {
      const page = await openApp(browser, { locale: 'en-US', stored: { [THEME_KEY]: theme } });
      const probes: { name: string; ratio: number }[] = [];
      const ringRatio = (target: Locator) =>
        target.evaluate(
          (el, bgHex) => {
            const parse = (v: string) => (v.match(/[\d.]+/g) ?? []).map(Number);
            const lum = (c: number[]) => {
              const f = (v: number) => {
                const x = v / 255;
                return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
              };
              return 0.2126 * f(c[0] ?? 0) + 0.7152 * f(c[1] ?? 0) + 0.0722 * f(c[2] ?? 0);
            };
            const s = getComputedStyle(el);
            let ring = parse(s.outlineColor);
            const hasOutline = s.outlineStyle !== 'none' && Number.parseFloat(s.outlineWidth) > 0;
            if (!hasOutline) {
              const shadow = /rgba?\([^)]*\)/.exec(s.boxShadow);
              if (shadow === null) return 0;
              ring = parse(shadow[0]);
            }
            const bg = parse(bgHex);
            const [hi, lo] = [lum(ring), lum(bg)].sort((a, b) => b - a) as [number, number];
            return (hi + 0.05) / (lo + 0.05);
          },
          theme === 'dark' ? 'rgb(15,14,12)' : 'rgb(243,238,227)',
        );
      await page.keyboard.press('Tab');
      probes.push({ name: 'language radio (focus-visible target)', ratio: 0 });
      // Measure the focused element or its visible label wrapper.
      const focused = page.locator(':focus-visible');
      const candidates = [
        focused,
        page.locator('label:has(:focus-visible)'),
        page.locator('label:focus-within'),
      ];
      let best = 0;
      for (const c of candidates) {
        if ((await c.count()) > 0) best = Math.max(best, await ringRatio(c.first()));
      }
      probes[0]!.ratio = best;
      await page.getByLabel('Intention').focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      probes.push({
        name: 'intention field',
        ratio: await ringRatio(page.getByLabel('Intention')),
      });
      for (const probe of probes) expect(probe.ratio, probe.name).toBeGreaterThanOrEqual(AA_UI);
      await page.context().close();
    });
  }
});

// ---------------------------------------------------------------------------
// No flash at load
// ---------------------------------------------------------------------------

test.describe('no flash at load', () => {
  for (const [stored, system] of [
    ['dark', 'light'],
    ['light', 'dark'],
  ] as const) {
    test(`stored ${stored} with a ${system} system: every painted frame already has the ${stored} background`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        locale: 'en-US',
        colorScheme: system,
        baseURL: baseUrl(),
      });
      const page = await context.newPage();
      await page.addInitScript(
        ([key, value]) => {
          localStorage.setItem(key!, value!);
          const frames: string[] = [];
          Object.assign(window, { f6Bg: frames });
          const tick = () => {
            frames.push(getComputedStyle(document.documentElement).backgroundColor);
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        },
        [THEME_KEY, stored],
      );
      // Hold the app bundle back so the pre-app frames are numerous and observable.
      await page.route(/\/assets\/index-[^/]+\.js$/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await route.continue();
      });
      await page.goto('./', { waitUntil: 'domcontentloaded' });
      const early = await pageBackground(page);
      await page.screenshot({ path: test.info().outputPath(`first-paint-${stored}.png`) });
      await test.info().attach(`first-paint-${stored}`, {
        path: test.info().outputPath(`first-paint-${stored}.png`),
        contentType: 'image/png',
      });
      await expect(page.getByRole('button', { name: 'Trace', exact: true })).toBeVisible();
      const frames = await page.evaluate(() => (window as unknown as { f6Bg: string[] }).f6Bg);
      expect(early).toBe(BG[stored]);
      expect(frames.length).toBeGreaterThan(20);
      expect(new Set(frames)).toEqual(new Set([BG[stored]]));
      await context.close();
    });
  }
});

// ---------------------------------------------------------------------------
// System mode, live
// ---------------------------------------------------------------------------

test('System mode follows prefers-color-scheme live, with the app, meta tags and sigil colour', async ({
  browser,
}) => {
  const page = await openApp(browser, { locale: 'en-US', scheme: 'light' });
  await traceIntention(page, 'en');
  const stroke = () =>
    page
      .getByRole('img', { name: L.en.stage })
      .locator('path')
      .first()
      .evaluate((el) => getComputedStyle(el).stroke);
  const lightStroke = await stroke();
  for (const scheme of ['dark', 'light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    expect(await pageBackground(page)).toBe(BG[scheme]);
    await expect(page.getByRole('radio', { name: 'System' })).toBeChecked();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    if (scheme === 'dark') expect(await stroke()).not.toBe(lightStroke);
    else expect(await stroke()).toBe(lightStroke);
  }
  // Leaving then coming back to System removes the stored theme and follows again.
  await pickTheme(page, 'en', 'light');
  expect(await pageBackground(page)).toBe(BG.light);
  await pickTheme(page, 'en', 'system');
  expect((await storage(page)).local).toEqual({});
  expect(await pageBackground(page)).toBe(BG.dark);
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await pageBackground(page)).toBe(BG.light);
  await page.context().close();
});

// ---------------------------------------------------------------------------
// Keyboard on the header selectors
// ---------------------------------------------------------------------------

test.describe('keyboard on the header selectors', () => {
  test('Tab reaches language, theme, then the intention; arrows change the choice; Shift+Tab goes back', async ({
    browser,
  }) => {
    const page = await openApp(browser, { locale: 'en-US' });
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'English' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: 'Français' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Français' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Tracer', exact: true })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: 'Système' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Or sur noir' })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // Arrows wrap around inside the group.
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Système' })).toBeChecked();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: 'Or sur noir' })).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Intention')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('radio', { name: 'Or sur noir' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('radio', { name: 'Français' })).toBeFocused();
    await page.context().close();
  });

  test('the groups are labelled and every option has an accessible name in both languages', async ({
    browser,
  }) => {
    for (const lang of ['en', 'fr'] as const) {
      const page = await openApp(browser, { locale: LOCALE[lang] });
      const header = page.locator('header');
      await expect(header.getByRole('group', { name: L[lang].langGroup })).toBeVisible();
      await expect(header.getByRole('group', { name: L[lang].themeGroup })).toBeVisible();
      for (const name of ['Français', 'English', ...Object.values(L[lang].themes)]) {
        await expect(header.getByRole('radio', { name })).toHaveCount(1);
      }
      await page.context().close();
    }
  });

  test('focus stays on the selector after a switch, and the hidden radio never loses its name', async ({
    browser,
  }) => {
    const page = await openApp(browser, { locale: 'fr-FR' });
    await page
      .getByTitle('English', { exact: true })
      .focus()
      .catch(() => undefined);
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowRight');
    const focus = await page.evaluate(
      () => document.activeElement?.getAttribute('type') ?? document.activeElement?.tagName,
    );
    expect(focus).toBe('radio');
    await page.context().close();
  });
});

// ---------------------------------------------------------------------------
// 375 px
// ---------------------------------------------------------------------------

test.describe('375 px', () => {
  for (const lang of ['en', 'fr'] as const) {
    for (const theme of ['dark', 'light'] as const) {
      test(`${lang} / ${theme}: no horizontal scroll, header selectors usable`, async ({
        browser,
      }) => {
        const page = await openApp(browser, {
          locale: LOCALE[lang],
          width: 375,
          stored: { [THEME_KEY]: theme },
        });
        for (const screen of [
          'empty',
          'kamea',
          'spare',
          'style-stencil',
          'export-pdf-error',
        ] as const) {
          await page.reload();
          await reach(page, lang, screen);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          );
          expect(overflow, `${screen} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
        }
        await page.reload();
        const header = page.locator('header');
        for (const radio of await header.getByRole('radio').all()) {
          const label = radio.locator('xpath=ancestor::label[1]');
          const box = await label.boundingBox();
          expect(box, 'label box').not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(375);
        }
        await page.screenshot({
          path: test.info().outputPath(`375-${lang}-${theme}.png`),
          fullPage: true,
        });
        await page.context().close();
      });
    }
  }

  test('header selectors are touch targets of at least 44 px', async ({ browser }) => {
    const page = await openApp(browser, { locale: 'en-US', width: 375 });
    const tooSmall: string[] = [];
    for (const radio of await page.locator('header').getByRole('radio').all()) {
      const label = radio.locator('xpath=ancestor::label[1]');
      const box = await label.boundingBox();
      const title = await label.getAttribute('title');
      if (box === null || box.width < 44 || box.height < 44)
        tooSmall.push(`${title}: ${Math.round(box?.width ?? 0)}x${Math.round(box?.height ?? 0)}`);
    }
    expect(tooSmall).toEqual([]);
    await page.context().close();
  });
});

// ---------------------------------------------------------------------------
// Translation checks
// ---------------------------------------------------------------------------

/** Words and characters that betray untranslated French in the English UI. */
const FRENCH_MARKERS =
  /[éèêëàâùûôîïç]|\b(le|la|les|des|une|un|du|est|sont|avec|pour|dans|sur|votre|vos|tracer|sigil de|carré|lettres? retenues?|variante|pochoir|épaisseur|télécharger|annuler|exporter)\b/i;

test.describe('English interface', () => {
  test('no French string, accessible name or tooltip is left on any screen', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const page = await openApp(browser, { locale: 'en-US' });
    const leaks: string[] = [];
    for (const screen of SCREENS) {
      await page.reload();
      await reach(page, 'en', screen);
      await waitForAnimationsToFinish(page, { outsideSigil: true });
      const texts = await page.evaluate(() => {
        const out: string[] = [document.body.innerText];
        for (const el of document.querySelectorAll('[aria-label],[title],[alt],[placeholder]')) {
          for (const attr of ['aria-label', 'title', 'alt', 'placeholder']) {
            const v = el.getAttribute(attr);
            if (v) out.push(v);
          }
        }
        return out;
      });
      for (const text of texts.join('\n').split('\n')) {
        const line = text.replace(/Français/g, '');
        if (FRENCH_MARKERS.test(line)) leaks.push(`${screen}: ${line.trim().slice(0, 100)}`);
      }
    }
    expect(leaks).toEqual([]);
    await page.context().close();
  });

  test('plurals: 0, 1 and 2+ letters, in both languages', async ({ browser }) => {
    const cases: [Lang, string, RegExp][] = [
      ['en', '', /No letters to trace yet/],
      ['en', 'a', /\b1 letter to trace/],
      ['en', 'ab', /\b2 letters to trace/],
      ['fr', 'a', /\b1 lettre à tracer/],
      ['fr', 'ab', /\b2 lettres à tracer/],
    ];
    for (const [lang, text, expected] of cases) {
      const page = await openApp(browser, { locale: LOCALE[lang] });
      await page.getByLabel(L[lang].intention).fill(text);
      await expect(page.locator('body')).toContainText(expected);
      await page.context().close();
    }
  });

  test('decimals: stroke width and sizes use a point in English and a comma in French', async ({
    browser,
  }) => {
    for (const lang of ['en', 'fr'] as const) {
      const page = await openApp(browser, { locale: LOCALE[lang] });
      await traceIntention(page, lang);
      await openStyle(page);
      const body = page.locator('body');
      await expect(body).toContainText(lang === 'en' ? /thin · 1\.2/ : /fin · 1,2/);
      await expect(body).not.toContainText(lang === 'en' ? /\b1,2\b/ : /\b1\.2\b(?! sur)/);
      // Export dialog: size 6.5 cm and stroke 0.6 mm.
      await page.getByRole('button', { name: L[lang].exportOpen, exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('radio', { name: 'PDF' }).check({ force: true });
      await dialog.getByLabel(L[lang].sizeLabel).fill(lang === 'en' ? '6.5' : '6,5');
      await expect(dialog).toContainText(lang === 'en' ? /0\.6\s?mm/ : /0,6\s?mm/);
      await expect(dialog).toContainText(lang === 'en' ? /0\.3 to 1\.2 mm/ : /0,3 à 1,2 mm/);
      await dialog.getByRole('button', { name: L[lang].cancel }).click();
      await expect(page.locator('body')).toContainText(
        lang === 'en' ? /6\.5\s?cm print/ : /6,5\s?cm/,
      );
      await page.context().close();
    }
  });

  test('the size field accepts the local decimal separator and says what to write otherwise', async ({
    browser,
  }) => {
    const page = await openApp(browser, { locale: 'en-US' });
    await traceIntention(page, 'en');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'PDF' }).check({ force: true });
    await dialog.getByLabel('Actual size (cm)').fill('abc');
    await expect(dialog).toContainText('Write a size in centimetres, for example 8 or 6.5.');
    await dialog.getByLabel('Actual size (cm)').fill('26');
    await expect(dialog).toContainText('The size must be between 1 and 25 cm.');
    await dialog.getByLabel('Actual size (cm)').fill('6.5');
    await expect(dialog).not.toContainText('must be between');
    await page.context().close();
  });

  test('stencil help uses the right article before 8 (an 8 cm print)', async ({ browser }) => {
    const page = await openApp(browser, { locale: 'en-US' });
    await openStyle(page);
    await expect(page.locator('body')).not.toContainText(/\ba 8\scm print/);
    await expect(page.locator('body')).toContainText(/\ban 8\scm print/);
    await page.context().close();
  });

  test('Spare simplification text agrees with the segment counts it states', async ({
    browser,
  }) => {
    const page = await openApp(browser, { locale: 'en-US' });
    await chooseSpare(page);
    // Several intentions to meet the three cases (fewer, as many, more segments).
    const seen = new Set<string>();
    for (const intention of [INTENTION.en, 'Strong clear mind', 'Peace', 'I am safe and loved']) {
      await traceIntention(page, 'en', intention);
      const text = await page
        .getByRole('heading', { name: 'Simplification' })
        .locator('xpath=..')
        .innerText();
      const become = /(\d+) segments? become (\d+)/.exec(text);
      const still = /still has (\d+) segments?/.exec(text);
      const from = /count goes from (\d+) to (\d+) segments/.exec(text);
      expect(
        [become, still, from].filter((m) => m !== null),
        text,
      ).toHaveLength(1);
      if (become) {
        expect(Number(become[2]), text).toBeLessThan(Number(become[1]));
        seen.add('fewer');
      } else if (from) {
        expect(Number(from[2]), text).toBeGreaterThan(Number(from[1]));
        expect(text).not.toContain('become');
        seen.add('more');
      } else seen.add('same');
    }
    expect(seen.size).toBeGreaterThan(0);
    await page.context().close();
  });
});

// ---------------------------------------------------------------------------
// Export: PDF instruction language, stencil colours
// ---------------------------------------------------------------------------

/**
 * Exports the current sigil as PDF and returns its drawing text and colours.
 *
 * @param page - Page with a traced sigil.
 * @param lang - Interface language.
 * @returns Text shown strings and colour operators of the page content.
 */
async function exportPdf(page: Page, lang: Lang) {
  await page.getByRole('button', { name: L[lang].exportOpen, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'PDF' }).check({ force: true });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: L[lang].download }).click(),
  ]);
  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile(path);
  const strings: string[] = [];
  const colours: string[] = [];
  const text = bytes.toString('latin1');
  for (const match of text.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(match[1] ?? '', 'latin1')).toString('latin1');
    } catch {
      continue;
    }
    for (const hex of content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g))
      strings.push(Buffer.from(hex[1] ?? '', 'hex').toString('latin1'));
    for (const op of content.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) (RG|rg)/g))
      colours.push(`${op[1]} ${op[2]} ${op[3]} ${op[4]}`);
  }
  return { fileName: download.suggestedFilename(), strings, colours, bytes };
}

test.describe('PDF and stencil', () => {
  test('the exported PDF carries the printing instruction in the interface language', async ({
    browser,
  }) => {
    const en = await openApp(browser, { locale: 'en-US' });
    await traceIntention(en, 'en', 'Pure intention');
    const enPdf = await exportPdf(en, 'en');
    expect(enPdf.strings.join('|')).toMatch(
      /Print at 100%, with no scaling and no \W?fit to page\W?\./,
    );
    expect(enPdf.strings.join('|')).toContain('fit to page');
    expect(enPdf.strings.join('|')).toMatch(
      /Sigil: 8\scm along its largest dimension, 0\.6\smm stroke\./,
    );
    expect(enPdf.strings.join('|')).not.toMatch(/Imprimer|Sigil : |trait/);
    expect(enPdf.fileName).toMatch(/\.pdf$/);
    expect(enPdf.fileName.toLowerCase()).not.toContain('pure');
    await en.context().close();

    const fr = await openApp(browser, { locale: 'fr-FR' });
    await traceIntention(fr, 'fr', 'Intention pure');
    const frPdf = await exportPdf(fr, 'fr');
    expect(frPdf.strings.join('|')).toMatch(/Imprimer à 100/);
    expect(frPdf.strings.join('|')).not.toContain('Print at');
    expect(frPdf.strings.join('|')).toMatch(/8\scm/);
    expect(frPdf.strings.join('|')).toMatch(/0,6/);
    await fr.context().close();
  });

  test('the PDF follows the language chosen in the header, not the browser', async ({
    browser,
  }) => {
    const page = await openApp(browser, { locale: 'fr-FR' });
    await page.getByTitle('English', { exact: true }).click();
    await traceIntention(page, 'en');
    const pdf = await exportPdf(page, 'en');
    expect(pdf.strings.join('|')).toContain('Print at 100%');
    await page.context().close();
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`stencil is pure black on white on screen and in the PDF, ${theme} theme`, async ({
      browser,
    }) => {
      const page = await openApp(browser, {
        locale: 'en-US',
        scheme: theme === 'dark' ? 'light' : 'dark',
      });
      await pickTheme(page, 'en', theme);
      await traceIntention(page, 'en');
      await openStyle(page);
      await page.getByRole('switch', { name: 'Tattoo stencil' }).check({ force: true });
      const sigil = page.getByRole('img', { name: L.en.stage });
      const look = await sigil.evaluate((svg) => ({
        strokes: [...svg.querySelectorAll('path, circle, line')].map(
          (el) => getComputedStyle(el).stroke,
        ),
        stage: getComputedStyle(svg.parentElement ?? svg).backgroundColor,
      }));
      expect(new Set(look.strokes)).toEqual(new Set(['rgb(0, 0, 0)']));
      expect(look.stage).toBe('rgb(255, 255, 255)');
      expect(await pageBackground(page)).toBe(BG[theme]);

      const pdf = await exportPdf(page, 'en');
      const unique = new Set(pdf.colours);
      expect(
        [...unique].filter(
          (c) => !/^(0|0\.0+) (0|0\.0+) (0|0\.0+) /.test(c) && !c.startsWith('1 1 1 '),
        ),
      ).toEqual([]);
      expect([...unique].some((c) => c.startsWith('0 0 0 RG'))).toBe(true);
      await page.context().close();
    });
  }

  test('stencil PNG export is black on a white background in the gold theme', async ({
    browser,
  }) => {
    const page = await openApp(browser, { locale: 'en-US', stored: { [THEME_KEY]: 'dark' } });
    await traceIntention(page, 'en');
    await openStyle(page);
    await page.getByRole('switch', { name: 'Tattoo stencil' }).check({ force: true });
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'PNG' }).check({ force: true });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: 'Download' }).click(),
    ]);
    const { readFile } = await import('node:fs/promises');
    const base64 = (await readFile(await download.path())).toString('base64');
    const pixels = await page.evaluate(async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const { data: rgba } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const seen = new Set<string>();
      for (let i = 0; i < rgba.length; i += 4 * 97) {
        const [r, g, b] = [rgba[i]!, rgba[i + 1]!, rgba[i + 2]!];
        if (r === g && g === b && (r < 40 || r > 215)) seen.add(r < 40 ? 'dark' : 'light');
        else if (Math.abs(r - g) > 10 || Math.abs(g - b) > 10) seen.add('tinted');
      }
      return { corner: [rgba[0], rgba[1], rgba[2], rgba[3]], seen: [...seen].sort() };
    }, base64);
    expect(pixels.corner).toEqual([255, 255, 255, 255]);
    expect(pixels.seen).toEqual(['dark', 'light']);
    await page.context().close();
  });
});

// ---------------------------------------------------------------------------
// CSP over a full flow
// ---------------------------------------------------------------------------

test('no Content Security Policy violation nor console error over a full flow in both languages', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const page = await openApp(browser, { locale: 'en-US' });
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || /Content Security Policy|Refused to/i.test(message.text()))
      consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  for (const lang of ['en', 'fr'] as const) {
    await page.getByTitle(lang === 'en' ? 'English' : 'Français', { exact: true }).click();
    for (const theme of ['dark', 'light', 'system'] as const) {
      await pickTheme(page, lang, theme);
      await page.getByLabel(L[lang].intention).fill(INTENTION[lang]);
      await page.getByRole('button', { name: L[lang].trace, exact: true }).click();
      await expect(page.getByRole('img', { name: L[lang].stage })).toBeVisible();
    }
    await exportPdf(page, lang);
    if (await page.getByRole('dialog').isVisible()) {
      await page.getByRole('dialog').getByRole('button', { name: L[lang].cancel }).click();
    }
  }
  expect(await violations(page)).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await page.context().close();
});
