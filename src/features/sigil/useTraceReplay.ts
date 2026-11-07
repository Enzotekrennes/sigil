/**
 * What the "replay" button does to the sigil shown.
 *
 * Exposes `useTraceReplay`. With motion allowed, a replay restarts the
 * tracing animation (a new replay token for `SigilRenderer`). Under
 * `prefers-reduced-motion: reduce`, it draws the sigil step by step instead:
 * each replay adds one step, the press after the last step starts over
 * (docs/design.md, "Animation du tracé"). A new sigil always shows whole.
 * Holds no timer and stores nothing outside React state.
 */
import { useState } from 'react';

import { stepwiseStepCount } from './stepwise.ts';
import type { Sigil } from './types.ts';
import { usePrefersReducedMotion } from './useTraceAnimation.ts';

/** Replay state handed to the scene and to the replay button. */
export interface TraceReplay {
  /** Changes on each animated replay; pass it to `SigilRenderer.replayToken`. */
  readonly replayToken: number;
  /**
   * Steps drawn in the step-by-step replay, 1 … `stepCount`; `undefined` when
   * the sigil is shown whole (motion allowed, or no replay pressed yet).
   */
  readonly step: number | undefined;
  /** Steps of the step-by-step replay of the sigil shown; 0 without a sigil. */
  readonly stepCount: number;
  /** Whether replays are step by step (reduced motion) rather than animated. */
  readonly stepwise: boolean;
  /** Replays the sigil: restarts the animation, or draws the next step. */
  readonly replay: () => void;
}

/** Step reached, tied to the sigil it was reached on so that a new sigil starts whole. */
interface StepState {
  readonly sigil: Sigil;
  readonly step: number;
}

/**
 * Drives the replay of the sigil shown.
 *
 * @param sigil - Sigil shown, or `undefined` before the first trace (replay
 *   then does nothing).
 * @returns The replay token, the step reached in step-by-step mode and the
 *   `replay` action.
 */
export function useTraceReplay(sigil: Sigil | undefined): TraceReplay {
  const stepwise = usePrefersReducedMotion();
  const [replayToken, setReplayToken] = useState(0);
  const [stepState, setStepState] = useState<StepState | null>(null);

  const stepCount = sigil === undefined ? 0 : stepwiseStepCount(sigil);
  const step =
    stepwise && sigil !== undefined && stepState?.sigil === sigil ? stepState.step : undefined;

  /** Restarts the animation, or draws one more step (back to the first after the last). */
  function replay() {
    if (sigil === undefined) return;
    if (!stepwise) {
      setReplayToken((token) => token + 1);
      return;
    }
    const next = step === undefined || step >= stepCount ? 1 : step + 1;
    setStepState({ sigil, step: next });
  }

  return { replayToken, step, stepCount, stepwise, replay };
}
