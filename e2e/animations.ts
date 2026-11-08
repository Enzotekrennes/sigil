/**
 * Shared waits of the end-to-end specs on the page's animations, read from
 * `document.getAnimations()` (CSS animations and transitions alike), so that a
 * spec waits for a state of the page instead of a fixed time.
 *
 * Not a spec file: Playwright only runs `*.spec.ts`.
 */
import type { Page } from '@playwright/test';

/**
 * Waits until the tracing of the sigil shown has played for at least the given
 * time, on the CSS animations' own clock (not the wall clock of the test).
 * Every stroke's drawing (`…-draw`) starts with the run, its delay included,
 * and its current time stops at its end: the furthest one still in the
 * document is the time elapsed since the run started, up to the last stroke's end.
 *
 * @param page - Page showing a sigil whose tracing is playing.
 * @param milliseconds - Time reached on the tracing's clock, in ms.
 * @returns Once that time is reached; the tracing keeps playing.
 * @throws {Error} When no drawing reaches that time within the test timeout
 *   (no tracing, or a tracing shorter than `milliseconds`).
 */
export async function waitForTracingTime(page: Page, milliseconds: number): Promise<void> {
  await page.waitForFunction((target) => {
    const elapsed = document
      .getAnimations()
      .filter((animation) => {
        const effect = animation.effect;
        const element = effect instanceof KeyframeEffect ? effect.target : null;
        return (
          animation instanceof CSSAnimation &&
          animation.animationName.endsWith('draw') &&
          element instanceof Element &&
          element.isConnected
        );
      })
      .map((animation) => Number(animation.currentTime ?? -1));
    return Math.max(-1, ...elapsed) >= target;
  }, milliseconds);
}

/**
 * Waits until every finite animation and transition of the page has finished.
 * Endless ones (a busy spinner) are ignored: they never finish.
 *
 * @param page - Page in the state to wait on.
 * @param options - What to wait for.
 * @param options.outsideSigil - `true` also ignores the animations of the sigil
 *   (its tracing lasts up to `--duration-trace-max`), to wait for the interface only.
 * @returns Once nothing finite is pending or running.
 */
export async function waitForAnimationsToFinish(
  page: Page,
  options: { readonly outsideSigil?: boolean } = {},
): Promise<void> {
  await page.waitForFunction(
    (outsideSigil) =>
      document.getAnimations().every((animation) => {
        if (animation.playState !== 'running' && !animation.pending) return true;
        const effect = animation.effect;
        if (effect === null || effect.getComputedTiming().iterations === Infinity) return true;
        const element = effect instanceof KeyframeEffect ? effect.target : null;
        return (
          outsideSigil && element instanceof Element && element.closest('svg[role="img"]') !== null
        );
      }),
    options.outsideSigil ?? false,
  );
}
