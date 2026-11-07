/**
 * Shared step for the end-to-end specs that depend on the offline service
 * worker: waits until it has precached the build and controls the page.
 *
 * Not a spec file: Playwright only runs `*.spec.ts`.
 */
import type { Page } from '@playwright/test';

/**
 * Waits until the service worker is active (its install step, which downloads
 * the whole precache, has succeeded) and controls the current page.
 *
 * @param page - A page already navigated to the app.
 * @returns Once the page is controlled by the service worker.
 * @throws {Error} When the worker never activates within the test timeout, for
 *   instance because a precached file failed to download.
 */
export async function waitForServiceWorkerControl(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // registerType "autoUpdate" makes the new worker claim open pages right after activation.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}
