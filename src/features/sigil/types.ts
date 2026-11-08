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
 *
 * @packageDocumentation
 */

/** A position in the normalised 0–100 frame. */
export interface Point {
  /** Horizontal position, 0 at the left edge of the frame, growing to the right. */
  readonly x: number;
  /** Vertical position, 0 at the top edge of the frame, growing downwards. */
  readonly y: number;
}

/** An axis-aligned rectangle in the normalised frame, in SVG `viewBox` order. */
export interface Box {
  /** x of the left edge, in frame units. */
  readonly x: number;
  /** y of the top edge, in frame units. */
  readonly y: number;
  /** Extent to the right of `x`, in frame units; never negative. */
  readonly width: number;
  /** Extent downwards from `y`, in frame units; never negative. */
  readonly height: number;
}

/** Hollow circle centred on the first point of the path: where the tracing starts. */
export interface StartCircleMark {
  /** Discriminant of the `Mark` union. */
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
  /** Discriminant of the `Mark` union. */
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
  /** Discriminant of the `Mark` union. */
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
   * `markGeometry.ts`), so it never touches the end bar crossing the end point.
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
  /** Discriminant of the `ExplanationStep` union. */
  readonly kind: 'kamea-conversion-rule';
  /** Identifier of the rule, `rank-wrap`: ((rank − 1) mod N²) + 1 with A = 1 … Z = 26. */
  readonly rule: 'rank-wrap';
  /** Planet whose square the sigil is traced on; it sets N. */
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
  /** Discriminant of the `ExplanationStep` union. */
  readonly kind: 'kamea-letter-table';
  /** One entry per normalised letter, repetitions included (kamea removes no letter, D3). */
  readonly entries: readonly KameaLetterEntry[];
}

/** A cell of a square, zero-based from the top-left corner. */
export interface GridCell {
  /** Row index, 0 for the top row, up to N − 1. */
  readonly row: number;
  /** Column index, 0 for the leftmost column, up to N − 1. */
  readonly column: number;
}

/** Kamea step: the square with the cells visited by the path, in order. */
export interface KameaSquarePathStep {
  /** Discriminant of the `ExplanationStep` union. */
  readonly kind: 'kamea-square-path';
  /** Planet of the square drawn, the same as in the conversion rule step. */
  readonly planet: Planet;
  /** Square values, row by row from the top. */
  readonly square: readonly (readonly number[])[];
  /** Numbers visited, one per letter, repetitions kept. */
  readonly numbers: readonly number[];
  /** Cell of each visited number, same order and length as `numbers`. */
  readonly cells: readonly GridCell[];
}

/**
 * A letter removed by the Spare reduction (decision D4): the trace
 * `reduceForSpare` produces and the explanation panel displays.
 */
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
  /** Discriminant of the `ExplanationStep` union. */
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

/** One retained letter, before and after its curves are redrawn with straight segments (D20). */
export interface SpareAngularSkeleton {
  /** The letter, A–Z. */
  readonly letter: string;
  /**
   * The Hershey skeleton, upright and untransformed, centred in the 0–100
   * frame with its cap height spanning the drawing area.
   */
  readonly glyph: readonly (readonly Point[])[];
  /** The angular skeleton, under the same fitting as `glyph`, so both can be drawn over each other. */
  readonly angular: readonly (readonly Point[])[];
  /** Number of straight segments of the angular skeleton. */
  readonly segmentCount: number;
}

/** Spare step: each retained letter redrawn with straight segments, in reduction order. */
export interface SpareAngularSkeletonsStep {
  /** Discriminant of the `ExplanationStep` union. */
  readonly kind: 'spare-angular-skeletons';
  /** One skeleton per retained letter, in the order of `SpareLetterReductionStep.kept`. */
  readonly letters: readonly SpareAngularSkeleton[];
}

/**
 * How a letter is hooked onto the stem of the bind rune: `stem`, one of its
 * vertical strokes lies on the stem; `centre`, it is centred on the stem,
 * which crosses it; `tip`, its single outermost corner touches the stem.
 */
export type SpareAttachment = 'stem' | 'centre' | 'tip';

/** One letter hooked onto the stem, in the sigil's frame, before the strokes are merged. */
export interface SpareStemAttachment {
  /** The letter, A–Z. */
  readonly letter: string;
  /** How the letter is hooked onto the stem. */
  readonly attachment: SpareAttachment;
  /** True when the letter is flipped left to right around the stem. */
  readonly mirrored: boolean;
  /** True when the letter is drawn twice, once on each side of the stem, mirror images of each other. */
  readonly doubled: boolean;
  /** Side of the stem the letter occupies, its double included. */
  readonly side: 'left' | 'right' | 'both';
  /** y of the letter's highest point on the stem, in the 0–100 frame. */
  readonly top: number;
  /** y of the letter's lowest point on the stem, in the 0–100 frame. */
  readonly bottom: number;
  /**
   * The letter's strokes (and its double's) as placed, in the sigil's 0–100
   * frame, before merging: drawing them with the stem shows the rune before
   * shared strokes are drawn once.
   */
  readonly strokes: readonly (readonly Point[])[];
}

/** Spare step: the stem and every letter hooked onto it. */
export interface SpareStemAttachmentsStep {
  /** Discriminant of the `ExplanationStep` union. */
  readonly kind: 'spare-stem-attachments';
  /** Ends of the vertical stem, top first, on the vertical through the frame centre. */
  readonly stem: {
    /** Upper end of the stem, in the 0–100 frame. */
    readonly top: Point;
    /** Lower end of the stem, straight below `top`. */
    readonly bottom: Point;
  };
  /** Letters from the top of the stem to the bottom, the order the variant hangs them in. */
  readonly order: readonly string[];
  /** Each retained letter's attachment, in reduction order (same order as `kept`). */
  readonly letters: readonly SpareStemAttachment[];
}

/**
 * Measures of a bind rune, on its merged strokes in the 0–100 frame, and the
 * penalty they add up to (see the weights in the Spare score).
 */
export interface SpareRuneScore {
  /** Pairs of parallel strokes 0.5–5 units apart side by side ("hatches"); the chosen rune should have 0. */
  readonly hatches: number;
  /** Total stroke length divided by the drawing area's side (80 units). */
  readonly ink: number;
  /** Height divided by width of the rune's bounding box. */
  readonly aspectRatio: number;
  /** Share of the ink, 0–1, whose mirror image across the stem lies on a stroke. */
  readonly symmetry: number;
  /** |left ink − right ink| / total ink, 0–1: 0 when both sides of the stem carry as much. */
  readonly imbalance: number;
  /** Crossings between strokes away from the stem. */
  readonly crossings: number;
  /**
   * Overlap of the letters' bounding boxes on a common side of the stem,
   * summed over pairs of letters as a share of the smaller box: 0 when no
   * two letters are drawn over each other.
   */
  readonly crowding: number;
  /** Mean height of the letters on the stem, in frame units. */
  readonly letterHeight: number;
  /** Weighted sum of the measures; the lowest penalty wins. */
  readonly penalty: number;
}

/** Layout of a Spare bind rune, fixed by the variant (see `SpareCandidateChoiceStep.style`). */
export type SpareRuneStyle = 'symmetric' | 'paired' | 'mixed';

/** Spare step: which candidate rune was chosen, and its measures. */
export interface SpareCandidateChoiceStep {
  /** Discriminant of the `ExplanationStep` union. */
  readonly kind: 'spare-candidate-choice';
  /** Variant number, 0 for the first sigil; it fixes the order of the letters, the style and the draws. */
  readonly variant: number;
  /**
   * Layout the variant asks of every candidate: `symmetric`, each one-sided
   * letter doubled by its mirror image; `paired`, no doubling, one-sided
   * letters share levels on either side of the stem; `mixed`, either, drawn
   * letter by letter.
   */
  readonly style: SpareRuneStyle;
  /** Number of runes drawn from the seed and scored. */
  readonly candidateCount: number;
  /** Zero-based index of the chosen rune, in draw order: the one with the lowest penalty. */
  readonly chosenIndex: number;
  /** Measures of the chosen rune. */
  readonly score: SpareRuneScore;
}

/** Spare step: the stem and the hooked letters merged into the sigil, shared strokes drawn once. */
export interface SpareSimplificationStep {
  /** Discriminant of the `ExplanationStep` union. */
  readonly kind: 'spare-simplification';
  /** Segments of the stem and the placed letters before merging. */
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
  | SpareAngularSkeletonsStep
  | SpareStemAttachmentsStep
  | SpareCandidateChoiceStep
  | SpareSimplificationStep;

/** A finished sigil, independent of the method that produced it and of any styling. */
export interface Sigil {
  /** Polylines in tracing order; each stroke has at least two distinct points. */
  readonly strokes: readonly (readonly Point[])[];
  /** Marks drawn over the strokes (start, end, loops); empty for methods that draw none, such as Spare. */
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
  /** Colouring: the current theme on screen, or pure black for a stencil. */
  readonly mode: RenderMode;
}
