/**
 * Build, dev-server and unit-test configuration.
 *
 * The site is published as a GitHub Pages project page, so every asset URL is
 * prefixed with `/sigil/`. Vitest reuses this file: unit tests run in jsdom
 * and only cover `src/`; end-to-end specs in `e2e/` belong to Playwright.
 */
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Public path of the GitHub Pages project site (`<account>.github.io/sigil/`). */
const BASE_PATH = '/sigil/';

export default defineConfig({
  base: BASE_PATH,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
