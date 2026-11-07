/**
 * Step-by-step replay of a sigil, for users who asked for reduced motion:
 * instead of an animated tracing, each press of "replay" draws one more step,
 * without any movement (docs/design.md, "Animation du tracé").
 *
 * Exposes `stepwiseStepCount` and `revealSteps`. A step is one segment of a
 * single-stroke sigil (kamea: from one letter's cell to the next) or one
 * whole stroke of a multi-stroke sigil (Spare, whose strokes have no letter
 * order). Pure functions: the step reached is kept by `useTraceReplay`.
 */
import type { Mark, Point, Sigil } from './types.ts';

/** What is drawn after a given number of steps. */
export interface RevealedSigil {
  /** Strokes, or beginnings of strokes, drawn so far, in tracing order. */
  readonly strokes: readonly (readonly Point[])[];
  /** Marks already reached by the path. */
  readonly marks: readonly Mark[];
  /** True once every step is drawn: the sigil is whole, framing circle included. */
  readonly complete: boolean;
}

/**
 * Number of steps of the step-by-step replay.
 *
 * @param sigil - Sigil to replay; each stroke has at least two points.
 * @returns The segment count of a single-stroke sigil, the stroke count
 *   otherwise; at least 1.
 */
export function stepwiseStepCount(sigil: Sigil): number {
  const [only] = sigil.strokes;
  if (sigil.strokes.length === 1 && only !== undefined) return Math.max(only.length - 1, 1);
  return Math.max(sigil.strokes.length, 1);
}

/**
 * Part of the sigil drawn after `step` steps.
 *
 * The start circle shows from the first step; a loop shows once the path has
 * reached the point of its `pathIndex` (or, without one, its cell); the end
 * bar and the framing circle wait for the last step, when the path is complete.
 *
 * @param sigil - Sigil to replay.
 * @param step - Steps drawn, an integer ≥ 1; values from `stepwiseStepCount`
 *   up give the whole sigil.
 * @returns The strokes and marks to draw, and whether the sigil is complete.
 */
export function revealSteps(sigil: Sigil, step: number): RevealedSigil {
  if (step >= stepwiseStepCount(sigil)) {
    return { strokes: sigil.strokes, marks: sigil.marks, complete: true };
  }

  const shown = Math.max(step, 1);
  const [only] = sigil.strokes;
  const strokes =
    sigil.strokes.length === 1 && only !== undefined
      ? [only.slice(0, shown + 1)]
      : sigil.strokes.slice(0, shown);
  const reached = strokes.flat();
  const marks = sigil.marks.filter((mark) => {
    if (mark.kind === 'start-circle') return true;
    if (mark.kind === 'end-bar') return false;
    // A loop that knows where its repetition happens shows at that step, even
    // when the path crossed its cell earlier (the last cell's loop, for one).
    if (mark.pathIndex !== undefined && sigil.strokes.length === 1) {
      return mark.pathIndex <= shown;
    }
    // Loops are anchored on a cell centre, computed by the same formula as the path points.
    return reached.some((point) => point.x === mark.anchor.x && point.y === mark.anchor.y);
  });
  return { strokes, marks, complete: false };
}
