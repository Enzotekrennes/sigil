/**
 * Shared model of a sigil, produced by every method (kamea, Spare) and
 * consumed by the renderer, the explanation panel and the exports.
 *
 * Exposes geometry types (`Point`, `Box`), the marks drawn on top of the
 * strokes (`Mark`), the explanation steps (`ExplanationStep`) and the `Sigil`
 * itself. Pure types only: no computation and no rendering concerns such as
 * colours or stroke width.
 *
 * Coordinates live in a square frame normalised to 0–100 on both axes, with
 * the SVG convention: x grows to the right, y grows downwards.
 */

/** A position in the normalised 0–100 frame. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** An axis-aligned rectangle in the normalised frame, in SVG `viewBox` order. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Hollow circle centred on the first point of the path: where the tracing starts. */
export interface StartCircleMark {
  readonly kind: 'start-circle';
  /** Centre of the circle, equal to the first point of the first stroke. */
  readonly center: Point;
  /** Radius in frame units. */
  readonly radius: number;
}

/** Short bar across the last point of the path, perpendicular to the last segment. */
export interface EndBarMark {
  readonly kind: 'end-bar';
  /** Middle of the bar, equal to the last point of the last stroke. */
  readonly center: Point;
  /**
   * Direction of the bar itself (not of the last segment), in degrees measured
   * from the positive x axis towards the positive y axis (clockwise on screen),
   * in the range [0, 180).
   */
  readonly angle: number;
  /** Full length of the bar in frame units, split evenly on both sides of `center`. */
  readonly length: number;
}

/**
 * Hollow circle touching the path at a point the path visits several times in
 * a row (a repeated number in a kamea square). It sits beside the path so the
 * strokes stay continuous.
 */
export interface LoopMark {
  readonly kind: 'loop';
  /** Point of the path the loop is attached to (tangency point). */
  readonly anchor: Point;
  /** Centre of the circle, at `radius` from `anchor`. */
  readonly center: Point;
  /** Radius in frame units. */
  readonly radius: number;
}

/** Any mark drawn over the strokes, discriminated by `kind`. */
export type Mark = StartCircleMark | EndBarMark | LoopMark;

/** Seven planets of Agrippa's magic squares, from the smallest square to the largest. */
export type Planet = 'saturn' | 'jupiter' | 'mars' | 'sun' | 'venus' | 'mercury' | 'moon';

/**
 * Kamea step: the rule converting letters to numbers.
 * The panel words the rule itself from `rule`; numbers are given for display.
 */
export interface KameaConversionRuleStep {
  readonly kind: 'kamea-conversion-rule';
  /** Identifier of the rule, `rank-wrap`: ((rank − 1) mod N²) + 1 with A = 1 … Z = 26. */
  readonly rule: 'rank-wrap';
  readonly planet: Planet;
  /** Side N of the square. */
  readonly order: number;
  /** Number of cells N², the largest number of the square. */
  readonly cellCount: number;
}

/** One line of the letter → number table. */
export interface KameaLetterEntry {
  /** Letter of the intention, A–Z. */
  readonly letter: string;
  /** Alphabetical rank, A = 1 … Z = 26. */
  readonly rank: number;
  /** Number of the square the letter maps to, 1 … N². */
  readonly number: number;
}

/** Kamea step: each retained letter with its rank and its number, in intention order. */
export interface KameaLetterTableStep {
  readonly kind: 'kamea-letter-table';
  readonly entries: readonly KameaLetterEntry[];
}

/** A cell of a square, zero-based from the top-left corner. */
export interface GridCell {
  readonly row: number;
  readonly column: number;
}

/** Kamea step: the square with the cells visited by the path, in order. */
export interface KameaSquarePathStep {
  readonly kind: 'kamea-square-path';
  readonly planet: Planet;
  /** Square values, row by row from the top. */
  readonly square: readonly (readonly number[])[];
  /** Numbers visited, one per letter, repetitions kept. */
  readonly numbers: readonly number[];
  /** Cell of each visited number, same order and length as `numbers`. */
  readonly cells: readonly GridCell[];
}

/**
 * One step of the "how it is made" panel, discriminated by `kind`.
 * Spare adds its own variants when that method lands.
 */
export type ExplanationStep = KameaConversionRuleStep | KameaLetterTableStep | KameaSquarePathStep;

/** A finished sigil, independent of the method that produced it and of any styling. */
export interface Sigil {
  /** Polylines in tracing order; each stroke has at least two distinct points. */
  readonly strokes: readonly (readonly Point[])[];
  readonly marks: readonly Mark[];
  /** Frame of the coordinates, always the 0–100 square. */
  readonly viewBox: Box;
  /** Explanation steps in reading order. */
  readonly steps: readonly ExplanationStep[];
  /**
   * Seed of the pseudo-random choices that produced the sigil (decision D6).
   * Methods without randomness, such as kamea, set it to 0.
   */
  readonly seed: number;
}
