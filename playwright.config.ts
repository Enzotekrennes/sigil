/**
 * End-to-end test configuration.
 *
 * Builds the production bundle and serves it with `vite preview`, so the specs
 * exercise exactly what GitHub Pages will serve under `/sigil/`. Only Chromium
 * is installed and run.
 */
import { defineConfig, devices } from '@playwright/test';

/** Fixed port so the preview server and the base URL always agree. */
const PREVIEW_PORT = 4173;

/** Root of the deployed app, including the GitHub Pages base path. */
const BASE_URL = `http://localhost:${String(PREVIEW_PORT)}/sigil/`;

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    // The interface follows the browser language on first load (F6); the specs
    // read the French interface unless they set another locale themselves.
    locale: 'fr-FR',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${String(PREVIEW_PORT)} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
