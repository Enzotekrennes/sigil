/**
 * Build, dev-server and unit-test configuration.
 *
 * The site is published as a GitHub Pages project page, so every asset URL is
 * prefixed with `/sigil/`. The production build is an installable PWA that
 * works offline: a generated service worker precaches the whole build (scripts,
 * styles, fonts, icons, legal files). The build also publishes LICENSE.txt,
 * NOTICE.txt, the Open Font Licenses of the two font families and the
 * third-party licence notices, and keeps legal comments through minification.
 * Vitest reuses this file: unit tests run in jsdom and only cover `src/`;
 * end-to-end specs in `e2e/` belong to Playwright.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

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
 * offline use, legal files (`.txt`) included. The web app manifest is added to the precache by the plugin itself.
 */
const PRECACHE_PATTERNS = ['**/*.{html,js,css,woff2,png,svg,txt}'];

/** Matches the Content-Security-Policy `<meta>` element of `index.html`, with its comment. */
const CSP_META_PATTERN =
  /\s*<!--\s*Content Security Policy[\s\S]*?-->\s*<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/;

/**
 * File name of the third-party licence notices in the built site: every
 * dependency bundled by Vite (`build.license`) plus the Workbox runtime of the
 * service worker. Markdown content in a `.txt` file, so that GitHub Pages
 * serves it as plain text the browser displays instead of downloading.
 */
const THIRD_PARTY_LICENSES_FILE = 'THIRD-PARTY-LICENSES.txt';

/**
 * Project files published next to the app, so that the deployed site carries
 * its own licence and the attributions it owes (Hershey Fonts, fonts,
 * dependencies): the SIL Open Font License must accompany the font files it
 * covers. Copied from the repository at build time: no second copy to keep in
 * sync. Key: source file, relative to the project root; value: published name,
 * the one NOTICE and LICENSE refer to.
 */
const LEGAL_FILES: Readonly<Record<string, string>> = {
  LICENSE: 'LICENSE.txt',
  NOTICE: 'NOTICE.txt',
  'src/assets/fonts/eb-garamond/OFL.txt': 'OFL-EB-Garamond.txt',
  'src/assets/fonts/ibm-plex-mono/OFL.txt': 'OFL-IBM-Plex-Mono.txt',
};

/**
 * Workbox packages that `generateSW` bundles into the service worker runtime
 * (`workbox-*.js`). The service worker is built by Workbox after Vite's bundle,
 * so `build.license` cannot see them: their notices are appended by hand.
 * Checked against the `workbox:<package>:<version>` markers of the built runtime.
 */
const WORKBOX_RUNTIME_PACKAGES = [
  'workbox-core',
  'workbox-precaching',
  'workbox-routing',
  'workbox-strategies',
];

/**
 * Finds the directory of a Workbox runtime package the way the service worker
 * build does: from `workbox-build`, itself resolved from `vite-plugin-pwa`.
 * A copy nested under `workbox-build` (when the root `node_modules` holds
 * another version) is therefore the one reported, as it is the one bundled.
 *
 * @param packageName - A package of `WORKBOX_RUNTIME_PACKAGES`.
 * @returns Absolute path of the package directory.
 * @throws {Error} When `vite-plugin-pwa`, `workbox-build` or the package cannot be resolved.
 */
function workboxPackageDir(packageName: string): string {
  const fromProject = createRequire(resolve(import.meta.dirname, 'package.json'));
  const fromPlugin = createRequire(fromProject.resolve('vite-plugin-pwa'));
  const fromWorkboxBuild = createRequire(fromPlugin.resolve('workbox-build'));
  return dirname(fromWorkboxBuild.resolve(`${packageName}/package.json`));
}

/**
 * Formats the licence notice of one Workbox runtime package as a section of
 * the third-party licences file, in the layout Vite uses for `build.license`.
 *
 * @param packageName - A package of `WORKBOX_RUNTIME_PACKAGES`.
 * @returns A Markdown section: heading with name, version (from the copy
 *   `workbox-build` bundles, see `workboxPackageDir`) and SPDX identifier,
 *   then the full text of its `LICENSE` file.
 * @throws {Error} When the package or its `LICENSE` file is missing.
 */
function packageLicenseSection(packageName: string): string {
  const packageDir = workboxPackageDir(packageName);
  const manifest = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8')) as {
    version: string;
    license: string;
  };
  const text = readFileSync(resolve(packageDir, 'LICENSE'), 'utf8').trim();
  return `\n## ${packageName} - ${manifest.version} (${manifest.license})\n\n${text}\n`;
}

/**
 * Publishes the legal files with the built site: `LICENSE.txt` and
 * `NOTICE.txt` copied from the repository, and the Workbox runtime notices
 * appended to the dependency licences that `build.license` emits. Being part
 * of the build output, they are precached with the rest of the app.
 *
 * @returns A Vite plugin applied to `vite build` only.
 * @throws {Error} At build time when a legal file, a Workbox package or the
 *   licences file emitted by `build.license` is missing.
 */
function publishLegalFiles(): Plugin {
  return {
    name: 'sigil:publish-legal-files',
    apply: 'build',
    generateBundle: {
      // After Vite's own licence plugin, so its file can be completed.
      order: 'post',
      handler(_options, bundle) {
        for (const [source, fileName] of Object.entries(LEGAL_FILES)) {
          this.emitFile({
            type: 'asset',
            fileName,
            source: readFileSync(resolve(import.meta.dirname, source), 'utf8'),
          });
        }

        const licenses = bundle[THIRD_PARTY_LICENSES_FILE];
        if (licenses?.type !== 'asset') {
          throw new Error(
            `${THIRD_PARTY_LICENSES_FILE} was not emitted: check build.license in vite.config.ts.`,
          );
        }
        licenses.source = `${String(licenses.source)}${WORKBOX_RUNTIME_PACKAGES.map(packageLicenseSection).join('')}`;
      },
    },
  };
}

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
  build: {
    // Licence notices of the dependencies bundled into the app (React, pdf-lib…).
    license: { fileName: THIRD_PARTY_LICENSES_FILE },
    rolldownOptions: {
      output: {
        // Keep legal comments (`/*!`, `@license`) through minification: the
        // Hershey Fonts acknowledgements must ship with the glyph data, and the
        // dependencies' own licence headers stay with their code.
        comments: { legal: true },
      },
    },
  },
  plugins: [
    react(),
    stripCspOnDevServer(),
    publishLegalFiles(),
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
