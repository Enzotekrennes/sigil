/**
 * Decides whether and when the sigil tracing animation runs.
 *
 * Exposes `useTraceAnimation`, which tells the renderer if it may animate
 * (not under `prefers-reduced-motion: reduce`) and gives a run key that
 * changes only for a new sigil or a replay request, never for a style change.
 * Does not hold any timing: durations and easings live in the CSS tokens.
 */
import { useSyncExternalStore } from 'react';

import type { Sigil } from './types.ts';

/** Media query of the user's reduced motion preference. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** State of the tracing animation for the current render. */
export interface TraceAnimation {
  /** False when the user asked for reduced motion: the final sigil is shown at once. */
  readonly animate: boolean;
  /**
   * Changes when a new sigil is shown or a replay is requested. Used as a
   * React key, so the animated elements are remounted and their CSS
   * animations start over.
   */
  readonly runKey: string;
}

/** Identity of each sigil object shown, so an identical-looking new sigil still replays. */
const sigilIds = new WeakMap<Sigil, number>();
let nextSigilId = 1;

/**
 * Stable identifier of a sigil object for the lifetime of the page.
 *
 * @param sigil - Sigil shown.
 * @returns The same number for the same object, a new one for any other object.
 */
function sigilId(sigil: Sigil): number {
  const known = sigilIds.get(sigil);
  if (known !== undefined) return known;
  const id = nextSigilId;
  nextSigilId += 1;
  sigilIds.set(sigil, id);
  return id;
}

/**
 * Reduced motion media query list, or undefined where `matchMedia` does not
 * exist (some test environments): motion is then allowed.
 *
 * @returns The media query list, if any.
 */
function reducedMotionQuery(): MediaQueryList | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

/**
 * Subscribes to changes of the reduced motion preference.
 *
 * @param onChange - Called when the preference changes.
 * @returns The unsubscribe function.
 */
function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = reducedMotionQuery();
  if (query === undefined) return () => undefined;
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/**
 * Current reduced motion preference.
 *
 * @returns True when the user asked for reduced motion.
 */
function prefersReducedMotion(): boolean {
  return reducedMotionQuery()?.matches ?? false;
}

/**
 * Tells the renderer whether to animate the tracing and when to restart it.
 *
 * @param sigil - Sigil shown; a different object starts a new run.
 * @param replayToken - Any value chosen by the parent; changing it replays
 *   the animation of the same sigil (the "replay" button).
 * @returns `animate`, false under `prefers-reduced-motion: reduce` and kept up
 *   to date if the preference changes, and the `runKey` of the current run.
 */
export function useTraceAnimation(sigil: Sigil, replayToken: number): TraceAnimation {
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    prefersReducedMotion,
    () => false,
  );
  return { animate: !reducedMotion, runKey: `${String(sigilId(sigil))}:${String(replayToken)}` };
}
