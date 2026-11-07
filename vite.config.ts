/**
 * Build, dev-server and unit-test configuration.
 *
 * The site is published as a GitHub Pages project page, so every asset URL is
 * prefixed with `/sigil/`. The production build is an installable PWA that
 * works offline: a generated service worker precaches the whole build (scripts,
 * styles, fonts, icons). Vitest reuses this file: unit tests run in jsdom and
 * only cover `src/`; end-to-end specs in `e2e/` belong to Playwright.
 */
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

/** Public path of the GitHub Pages project site (`<account>.github.io/sigil/`). */
const BASE_PATH = '/sigil/';

/** Page background of the "ink on paper" theme (`--color-bg` in `src/styles/tokens.css`). */
const PAPER_COLOR = '#f3eee3';

/**
 * Every file type the build emits, so the first visit caches the whole app for
 * offline use. The web app manifest is added to the precache by the plugin itself.
 */
const PRECACHE_PATTERNS = ['**/*.{html,js,css,woff2,png,svg}'];

/** Matches the Content-Security-Policy `<meta>` element of `index.html`, with its comment. */
const CSP_META_PATTERN =
  /\s*<!--\s*Content Security Policy[\s\S]*?-->\s*<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/;

/**
 * Removes the Content-Security-Policy `<meta>` from `index.html` on the dev
 * server only. The dev server injects inline scripts (React fast refresh) and
 * `<style>` elements (hot CSS) that the production policy rightly blocks; the
 * built site, which is what gets deployed, keeps the policy untouched.
 *
 * @returns A Vite plugin applied to `vite serve` only.
 * @throws {Error} When the policy can no longer be found, so a renamed or reformatted
 *   `<meta>` is noticed instead of silently left in place.
 */
function stripCspOnDevServer(): Plugin {
  return {
    name: 'sigil:strip-csp-on-dev-server',
    apply: 'serve',
    transformIndexHtml(html) {
      if (!CSP_META_PATTERN.test(html)) {
        throw new Error(
          'Cannot find the Content-Security-Policy <meta> (and its comment) in index.html: update CSP_META_PATTERN in vite.config.ts.',
        );
      }
      return html.replace(CSP_META_PATTERN, '');
    },
  };
}

export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    stripCspOnDevServer(),
    VitePWA({
      strategies: 'generateSW',
      // A new deploy replaces the old cache on the next visit, no prompt to answer.
      registerType: 'autoUpdate',
      // Registration loaded from a file: an inline script would be blocked by the CSP.
      injectRegister: 'script',
      // The icons are already matched by PRECACHE_PATTERNS: listing them twice would duplicate entries.
      includeManifestIcons: false,
      workbox: {
        globPatterns: PRECACHE_PATTERNS,
        cleanupOutdatedCaches: true,
        // What "autoUpdate" means; set by hand because the plugin only infers it with injectRegister "auto".
        skipWaiting: true,
        clientsClaim: true,
      },
      manifest: {
        id: BASE_PATH,
        name: 'Sigil',
        short_name: 'Sigil',
        description:
          'Générateur de sigils déterministe : carrés magiques (kamea) et méthode de Spare, tracés en SVG dans le navigateur.',
        // One manifest, in French, the project's default language: a manifest cannot
        // follow the in-app language switch, and the installed name "Sigil" is the same in both.
        lang: 'fr',
        dir: 'ltr',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: 'standalone',
        background_color: PAPER_COLOR,
        theme_color: PAPER_COLOR,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
