/**
 * Shared model of a sigil, produced by every method (kamea, Spare) and
 * consumed by the renderer, the explanation panel and the exports.
 *
 * Exposes geometry types (`Point`, `Box`), the marks drawn on top of the
 * strokes (`Mark`), the explanation steps (`ExplanationStep`) and the `Sigil`
 * itself, plus the style settings of its rendering (`StyleOptions`). Pure
 * types only: no computation, and the `Sigil` carries no rendering concern
 * such as colours or stroke width.
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
  /** Radius in frame units, for the reference stroke width. */
  readonly radius: number;
  /**
   * Largest radius the renderer may give the circle as the stroke thickens,
   * in frame units; set by methods whose marks must stay within a cell.
   * Absent: the radius follows the stroke width without limit.
   */
  readonly maxRadius?: number;
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
  /**
   * Full length of the bar in frame units, for the reference stroke width,
   * split evenly on both sides of `center`.
   */
  readonly length: number;
  /**
   * Largest length the renderer may give the bar as the stroke thickens, in
   * frame units. Absent: the length follows the stroke width without limit.
   */
  readonly maxLength?: number;
}

/**
 * Hollow circle touching the path at a point the path visits several times in
 * a row (a repeated number in a kamea square). It sits beside the path so the
 * strokes stay continuous.
 */
export interface LoopMark {
  readonly kind: 'loop';
  /**
   * Point of the path the loop belongs to: a visited cell centre. The loop
   * touches the path there, except on the last cell (see `lastSegment`).
   */
  readonly anchor: Point;
  /**
   * Centre of the circle for the reference stroke width: `radius` from
   * `anchor`, or placed beside the last segment when `lastSegment` is set.
   */
  readonly center: Point;
  /** Radius in frame units, for the reference stroke width. */
  readonly radius: number;
  /**
   * Largest radius the renderer may give the loop as the stroke thickens, in
   * frame units. Absent: the radius follows the stroke width without limit.
   */
  readonly maxRadius?: number;
  /**
   * Only on the loop of the path's last cell, whose anchor is the end point:
   * the vector from the end point back to the previous point of the path.
   * The loop then touches that segment back from the end by its radius plus
   * a clearance growing with the stroke width (see `placeEndLoop` in
   * `style.ts`), so it never touches the end bar crossing the end point.
   */
  readonly lastSegment?: Point;
  /**
   * Index, in the (single) stroke, of the point where the repetition the
   * loop marks happens, so a step-by-step replay shows the loop at that step.
   * Absent: the loop shows once the path reaches `anchor`.
   */
  readonly pathIndex?: number;
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

/** A letter removed by the Spare reduction (decision D4). */
export interface SpareRemovedLetter {
  /** The removed letter, A–Z. */
  readonly letter: string;
  /** Zero-based index in the normalised letters of the intention. */
  readonly position: number;
  /** `duplicate`: it already appeared earlier; `vowel`: A E I O U, vowels not kept (D11). */
  readonly reason: 'duplicate' | 'vowel';
}

/** Spare step: the normalised letters, those removed with the reason, and those retained. */
export interface SpareLetterReductionStep {
  readonly kind: 'spare-letter-reduction';
  /** Normalised letters of the intention, in order, repetitions included. */
  readonly letters: readonly string[];
  /** Whether vowels were kept (only duplicates removed). */
  readonly keepVowels: boolean;
  /** Removed letters in input order. */
  readonly removed: readonly SpareRemovedLetter[];
  /** Retained letters, in order of first appearance: the letters composed. */
  readonly kept: readonly string[];
}

/** How one letter was transformed and where it lands, before the strokes are merged. */
export interface SpareLetterPlacement {
  /** The letter, A–Z. */
  readonly letter: string;
  /** True when the letter is flipped left to right, applied before the turn. */
  readonly mirrored: boolean;
  /** Clockwise quarter turn on screen, in degrees, applied after the mirror. */
  readonly rotation: 0 | 90 | 180 | 270;
  /** Size relative to the other letters (1 = largest possible), about 0.55–1. */
  readonly scale: number;
  /** Index in `letters` of the letter whose vertical stem this one shares, or `null`. */
  readonly sharedStemWith: number | null;
  /**
   * The upright, untransformed skeleton, centred in the 0–100 frame with its
   * larger side spanning the drawing area: what the letter looks like alone.
   */
  readonly glyph: readonly (readonly Point[])[];
  /**
   * The letter's strokes once transformed and placed, in the sigil's 0–100
   * frame (same position as in the final sigil), before merging: drawing every
   * letter's `strokes` on top of each other shows the superimposition.
   */
  readonly strokes: readonly (readonly Point[])[];
}

/** Spare step: each retained letter, its skeleton and its transforms, in input order. */
export interface SpareLetterPlacementsStep {
  readonly kind: 'spare-letter-placements';
  readonly letters: readonly SpareLetterPlacement[];
}

/** Spare step: which candidate composition was chosen, and why. */
export interface SpareCandidateChoiceStep {
  readonly kind: 'spare-candidate-choice';
  /** Number of compositions drawn from the seed and scored. */
  readonly candidateCount: number;
  /** Zero-based index of the chosen composition, in draw order. */
  readonly chosenIndex: number;
  /**
   * Distance of the chosen composition's centre of gravity from the frame
   * centre before recentring, as a fraction of the frame side (0.03 = 3 %).
   * The final sigil is recentred on it.
   */
  readonly centreOffset: number;
  /** Share of the drawing area covered by the recentred bounding box, 0–1. */
  readonly fill: number;
  /** Indices in the retained letters of the letters touching no other one. */
  readonly isolatedLetters: readonly number[];
  /** Indices in the retained letters of the letters drawn exactly as written (upright or symmetric). */
  readonly uprightLetters: readonly number[];
  /** Total penalty of the chosen composition (lower is better), the lowest of all. */
  readonly penalty: number;
}

/** Spare step: the superimposed strokes merged and simplified into the sigil. */
export interface SpareSimplificationStep {
  readonly kind: 'spare-simplification';
  /** Segments of the superimposed letters before merging. */
  readonly segmentCountBefore: number;
  /** Segments of the final sigil, once overlaps and duplicates are drawn once. */
  readonly segmentCountAfter: number;
}

/** One step of the "how it is made" panel, discriminated by `kind`. */
export type ExplanationStep =
  | KameaConversionRuleStep
  | KameaLetterTableStep
  | KameaSquarePathStep
  | SpareLetterReductionStep
  | SpareLetterPlacementsStep
  | SpareCandidateChoiceStep
  | SpareSimplificationStep;

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

/**
 * How the sigil is coloured: `screen` follows the current theme tokens,
 * `stencil` is pure black for a tattoo stencil, without the decorative framing
 * circle.
 */
export type RenderMode = 'screen' | 'stencil';

/**
 * Visual settings of a rendered sigil. They never change the shape, only how
 * it is drawn, so changing them does not replay the tracing animation.
 */
export interface StyleOptions {
  /**
   * Stroke width in units of the 0–100 frame; 1.2 is the design default
   * (12 in the design's 1000-unit frame). Marks are resized with it.
   */
  readonly strokeWidth: number;
  /**
   * Rounded line ends and joins when true; flat ends with mitred joins when
   * false (`butt` + `miter`).
   */
  readonly roundEnds: boolean;
  /** Draws the framing circle around the sigil. Ignored in `stencil` mode. */
  readonly frameCircle: boolean;
  readonly mode: RenderMode;
}
