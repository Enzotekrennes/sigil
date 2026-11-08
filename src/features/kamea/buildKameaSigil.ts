/**
 * Builds a sigil with the magic square (kamea) method.
 *
 * Letters → numbers (decision D2) → centres of the matching cells of the
 * planet's square → one polyline, with a circle at the start, a bar
 * perpendicular to the last segment at the end, and a loop on each cell where
 * the same number comes several times in a row (decision D3). Marks are sized
 * to the cells of the square so they stay inside them from the 3 × 3 to the
 * 9 × 9. Also produces the explanation steps. Pure and deterministic: no
 * randomness, no I/O.
 * Does not normalise the intention: letters arrive already reduced to A–Z.
 */
import { FRAME_SIZE, MARK_REFERENCE_STROKE_WIDTH } from '../sigil/frame.ts';
import { placeEndLoop } from '../sigil/index.ts';
import type {
  EndBarMark,
  ExplanationStep,
  GridCell,
  KameaLetterEntry,
  LoopMark,
  Mark,
  Planet,
  Point,
  Sigil,
} from '../sigil/types.ts';
import { CONVERSION_RULE, letterRank, rankToNumber } from './conversion.ts';
import { kameaCellCenter, kameaCellSize } from './grid.ts';
import { KAMEA_SQUARES } from './squares.ts';

/**
 * Stroke width mark sizes are expressed in, as multiples of it, as in the
 * "Sigil stroke" section of the design document.
 */
const REFERENCE_STROKE_WIDTH = MARK_REFERENCE_STROKE_WIDTH;

/**
 * Start circle radius on large cells: 2.5 stroke widths, large enough to read
 * as hollow. Smaller squares shrink it with the mark scale (see `markSizes`),
 * down to `START_CIRCLE_MIN_RADIUS`.
 */
const START_CIRCLE_RADIUS = 2.5 * REFERENCE_STROKE_WIDTH;

/**
 * Smallest start circle radius: 2 stroke widths. The path begins at the
 * circle's centre, so the line end (half a stroke) sits in its hole; at this
 * radius a ring of paper one stroke wide stays visible around it, where the
 * scaled 1.5 of the Moon left the hole nearly filled. The circle is centred on
 * its cell, so 2.4 + 0.6 still fits the Moon's 4.4-unit half cell.
 */
const START_CIRCLE_MIN_RADIUS = 2 * REFERENCE_STROKE_WIDTH;

/**
 * End bar length on large cells: 8 stroke widths, clearly longer than the line
 * is thick. Smaller squares shrink it with the mark scale.
 */
const END_BAR_LENGTH = 8 * REFERENCE_STROKE_WIDTH;

/**
 * Loop radius on large cells: 3 stroke widths, slightly larger than the start
 * circle to tell them apart. Smaller squares shrink it with the mark scale;
 * there the start circle, held at its minimum, may be the larger one, and the
 * two still differ in shape: the line runs into the start circle's centre but
 * only touches a loop's edge.
 */
const LOOP_RADIUS = 3 * REFERENCE_STROKE_WIDTH;

/**
 * Smallest cell side, in frame units, that holds the marks at their full size.
 * A loop reaches two radii from the cell centre plus half a stroke, and
 * 2 × 3.6 + 0.6 = 7.8 fits in the 9-unit half cell with a little room. Below
 * it every mark shrinks by `cellSize / 18`, so a loop keeps reaching 40 % of
 * the cell side (plus half a stroke) and the end bar 27 % on each side of the
 * cell centre. Saturn (26.7) and Jupiter (20) keep the full
 * size; Mars (16) shrinks to 0.89, the Moon (8.9) to 0.49.
 */
const MARK_REFERENCE_CELL_SIZE = 18;

/**
 * Largest loop diameter as a share of the cell side, whatever the stroke
 * width: 45 %. The loop then stays within its cell up to a stroke of about
 * 2, and the last cell's loop, its radius plus its clearance from the end bar
 * (3.6 at the thickest stroke offered, `STROKE_WIDTH_MAX` 2.4), still fits
 * beside a last segment one cell long: 0.225 × 8.9 + 3.6 = 5.6 on the Moon.
 * Never reached at the reference width (the loop is at most 40 % of the cell
 * there).
 */
const LOOP_MAX_DIAMETER_SHARE = 0.45;

/**
 * Largest start circle radius as a share of the cell side: 0.3, a diameter of
 * 60 % that keeps the circle inside its cell up to a stroke of about 1.8 and
 * just larger than the capped loop, as at the reference width on small
 * squares. Never reached at the reference width (at most 0.27 of the Moon's
 * cell).
 */
const START_CIRCLE_MAX_SHARE = 0.3;

/**
 * Largest end bar length as a share of the cell side: 60 %, so the bar stays
 * inside its cell up to a stroke of about 3.5. Never reached at the reference
 * width (at most 53 % of the cell).
 */
const END_BAR_MAX_SHARE = 0.6;

/** Kamea has no pseudo-random choice, so its seed is a constant (see `Sigil.seed`). */
const KAMEA_SEED = 0;

/** Fewest letters that still give a line: one letter is a single point. */
const MIN_LETTERS = 2;

/** Tolerance below which a vector counts as null, far under any cell size. */
const EPSILON = 1e-9;

/** Null vector. */
const ZERO: Point = { x: 0, y: 0 };

/** Unit vector along the x axis, fallback direction. */
const UNIT_X: Point = { x: 1, y: 0 };

/** Business error preventing a kamea sigil from being drawn. */
export type KameaError =
  /** Fewer than two letters: no segment can be drawn. */
  | {
      readonly code: 'TOO_FEW_LETTERS';
      /** Number of letters given: 0 or 1. */
      readonly letterCount: number;
    }
  /** A letter outside A–Z reached the method (normalisation was skipped). */
  | {
      readonly code: 'INVALID_LETTER';
      /** The item refused, as given. */
      readonly letter: string;
      /** Zero-based position of the item in the letters given. */
      readonly index: number;
    }
  /** Every letter falls on the same cell: the path would be a single point. */
  | {
      readonly code: 'SINGLE_CELL';
      /** The number of the square every letter maps to, 1 … N². */
      readonly number: number;
    };

/** Outcome of `buildKameaSigil`: the sigil, or the reason it cannot be drawn. */
export type KameaResult =
  { readonly ok: true; readonly data: Sigil } | { readonly ok: false; readonly error: KameaError };

/**
 * Draws the kamea sigil of an intention on a planet's square.
 *
 * @param letters - Retained letters of the intention, one upper-case A–Z letter
 *   per item, in order, repetitions kept (decision D3).
 * @param planet - Planet whose square is used.
 * @returns `{ ok: true, data }` with the sigil in the 0–100 frame, or
 *   `{ ok: false, error }` with `TOO_FEW_LETTERS` (fewer than two letters),
 *   `INVALID_LETTER` (an item is not a single A–Z letter) or `SINGLE_CELL`
 *   (all letters give the same number). Never throws. Calling it twice with
 *   the same arguments gives deeply equal results.
 */
export function buildKameaSigil(letters: readonly string[], planet: Planet): KameaResult {
  if (letters.length < MIN_LETTERS) {
    return { ok: false, error: { code: 'TOO_FEW_LETTERS', letterCount: letters.length } };
  }

  const square = KAMEA_SQUARES[planet];
  const order = square.length;
  const cellCount = order * order;

  const entries: KameaLetterEntry[] = [];
  for (const [index, letter] of letters.entries()) {
    const rank = letterRank(letter);
    if (rank === undefined) {
      return { ok: false, error: { code: 'INVALID_LETTER', letter, index } };
    }
    entries.push({ letter, rank, number: rankToNumber(rank, cellCount) });
  }

  const numbers = entries.map((entry) => entry.number);
  const first = numbers[0] ?? 0;
  if (numbers.every((value) => value === first)) {
    return { ok: false, error: { code: 'SINGLE_CELL', number: first } };
  }

  const cellOf = indexCells(square);
  // Every number 1 … N² is in the square (checked by the tests), so the fallback never applies.
  const cells = numbers.map((value) => cellOf.get(value) ?? { row: 0, column: 0 });
  const visited = cells.map((cell) => kameaCellCenter(cell, order));
  const stroke = removeConsecutiveDuplicates(visited);

  const steps: ExplanationStep[] = [
    { kind: 'kamea-conversion-rule', rule: CONVERSION_RULE, planet, order, cellCount },
    { kind: 'kamea-letter-table', entries },
    { kind: 'kamea-square-path', planet, square, numbers, cells },
  ];

  return {
    ok: true,
    data: {
      strokes: [stroke],
      marks: buildMarks(stroke, numbers, visited, markSizes(order)),
      viewBox: { x: 0, y: 0, width: FRAME_SIZE, height: FRAME_SIZE },
      steps,
      seed: KAMEA_SEED,
    },
  };
}

/**
 * Indexes a square by value.
 *
 * @param square - Square values, row by row.
 * @returns Map from each value to its zero-based cell.
 */
function indexCells(square: readonly (readonly number[])[]): Map<number, GridCell> {
  const cells = new Map<number, GridCell>();
  for (const [row, values] of square.entries()) {
    for (const [column, value] of values.entries()) cells.set(value, { row, column });
  }
  return cells;
}

/**
 * Sizes of the marks for one square, in frame units: at the reference stroke
 * width, and the caps the renderer may not exceed as the stroke thickens.
 */
interface MarkSizes {
  readonly startCircleRadius: number;
  readonly startCircleMaxRadius: number;
  readonly endBarLength: number;
  readonly endBarMaxLength: number;
  readonly loopRadius: number;
  readonly loopMaxRadius: number;
}

/**
 * Sizes the marks to the cells of a square, so that no mark spills onto the
 * neighbouring cells. Large cells keep the design sizes (the cap); smaller
 * ones shrink every mark by the same factor, the start circle stopping at
 * `START_CIRCLE_MIN_RADIUS` so its hole stays visible. Also gives each mark
 * its cap relative to the cell, so that thick strokes do not blow the marks
 * over the neighbouring cells.
 *
 * @param order - Side N of the square, 3 to 9.
 * @returns The start circle radius, end bar length and loop radius, and their caps.
 */
function markSizes(order: number): MarkSizes {
  const cellSize = kameaCellSize(order);
  const markScale = Math.min(1, cellSize / MARK_REFERENCE_CELL_SIZE);
  return {
    startCircleRadius: Math.max(START_CIRCLE_RADIUS * markScale, START_CIRCLE_MIN_RADIUS),
    startCircleMaxRadius: START_CIRCLE_MAX_SHARE * cellSize,
    endBarLength: END_BAR_LENGTH * markScale,
    endBarMaxLength: END_BAR_MAX_SHARE * cellSize,
    loopRadius: LOOP_RADIUS * markScale,
    loopMaxRadius: (LOOP_MAX_DIAMETER_SHARE * cellSize) / 2,
  };
}

/**
 * Drops points equal to the one before, so the polyline has no zero-length segment.
 *
 * @param points - Points in path order.
 * @returns The same path without consecutive repetitions.
 */
function removeConsecutiveDuplicates(points: readonly Point[]): Point[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return previous === undefined || !samePoint(previous, point);
  });
}

/**
 * Builds the start circle, the end bar and one loop per cell holding a run of
 * repeated numbers.
 *
 * A cell gets a single loop even when several separate runs fall on it: the
 * loop says "this cell is repeated", the path already shows how often the
 * cell is visited, and stacked loops would merge into a blot on the small
 * cells of the 9 × 9. The loop follows the path at the cell's first run, and
 * records that run's place in the stroke for the step-by-step replay. On the
 * last cell it sits beside the last segment, clear of the end bar.
 *
 * @param stroke - Path without consecutive duplicates, at least two points.
 * @param numbers - Numbers visited, one per letter.
 * @param visited - Cell centre of each number, same length as `numbers`.
 * @param sizes - Mark sizes for the square.
 * @returns Marks in drawing order: start, loops along the path, end.
 */
function buildMarks(
  stroke: readonly Point[],
  numbers: readonly number[],
  visited: readonly Point[],
  sizes: MarkSizes,
): Mark[] {
  const start = stroke[0];
  const end = stroke[stroke.length - 1];
  const beforeEnd = stroke[stroke.length - 2];
  if (start === undefined || end === undefined || beforeEnd === undefined) return [];

  const marks: Mark[] = [
    {
      kind: 'start-circle',
      center: start,
      radius: sizes.startCircleRadius,
      maxRadius: sizes.startCircleMaxRadius,
    },
  ];
  const loopedNumbers = new Set<number>();
  for (const [index, point] of visited.entries()) {
    const value = numbers[index];
    const startsRun = value === numbers[index + 1] && value !== numbers[index - 1];
    if (!startsRun || value === undefined || loopedNumbers.has(value)) continue;
    loopedNumbers.add(value);
    const previous = findDistinct(visited, index, -1);
    const next = findDistinct(visited, index, 1);
    const loop = samePoint(point, end)
      ? buildEndLoop(stroke, sizes.loopRadius)
      : buildLoop(point, previous, next, sizes.loopRadius);
    marks.push({
      ...loop,
      maxRadius: sizes.loopMaxRadius,
      pathIndex: strokeIndexOf(visited, index),
    });
  }
  marks.push({
    ...buildEndBar(beforeEnd, end, sizes.endBarLength),
    maxLength: sizes.endBarMaxLength,
  });
  return marks;
}

/**
 * Index in the stroke (consecutive repetitions dropped) of a visited point.
 *
 * @param visited - Cell centre of each number, repetitions kept.
 * @param index - Index in `visited`.
 * @returns How many times the path has moved to another cell up to `index`.
 */
function strokeIndexOf(visited: readonly Point[], index: number): number {
  let moves = 0;
  for (let position = 1; position <= index; position += 1) {
    const previous = visited[position - 1];
    const current = visited[position];
    if (previous !== undefined && current !== undefined && !samePoint(previous, current)) {
      moves += 1;
    }
  }
  return moves;
}

/**
 * Finds the nearest point of the path that differs from `points[from]`.
 *
 * @param points - Visited points, repetitions kept.
 * @param from - Index to start from.
 * @param step - -1 to look backwards, 1 to look forwards.
 * @returns The first different point in that direction, or `undefined` at the path's end.
 */
function findDistinct(points: readonly Point[], from: number, step: -1 | 1): Point | undefined {
  const origin = points[from];
  if (origin === undefined) return undefined;
  for (let index = from + step; index >= 0 && index < points.length; index += step) {
    const point = points[index];
    if (point !== undefined && !samePoint(point, origin)) return point;
  }
  return undefined;
}

/**
 * Places a loop tangent to the path at `anchor`, on the outer side of the turn
 * so it does not overlap the neighbouring segments.
 *
 * @param anchor - Repeated point.
 * @param previous - Point the path comes from, if any.
 * @param next - Point the path goes to, if any. At least one of the two exists.
 * @param radius - Loop radius in frame units.
 * @returns The loop mark.
 */
function buildLoop(
  anchor: Point,
  previous: Point | undefined,
  next: Point | undefined,
  radius: number,
): LoopMark {
  const incoming = previous === undefined ? undefined : unit(subtract(anchor, previous));
  const outgoing = next === undefined ? undefined : unit(subtract(next, anchor));

  // Tangent of the path at the anchor: the bisector of both directions, or the
  // incoming direction alone when the path turns back on itself.
  let tangent = add(incoming ?? ZERO, outgoing ?? ZERO);
  if (length(tangent) < EPSILON) tangent = incoming ?? outgoing ?? UNIT_X;
  let normal = unit({ x: -tangent.y, y: tangent.x });

  // The turn bends towards `outgoing − incoming`; the loop goes the other way.
  if (incoming !== undefined && outgoing !== undefined) {
    const turn = subtract(outgoing, incoming);
    if (dot(normal, turn) > 0) normal = scale(normal, -1);
  }

  return {
    kind: 'loop',
    anchor,
    center: add(anchor, scale(normal, radius)),
    radius,
  };
}

/**
 * Places the loop of the last cell beside the last segment, on the side away
 * from the segment before. A loop tangent at the end point would always touch
 * the end bar, which crosses that very point, so `placeEndLoop` moves its
 * tangency point back by its radius plus a clearance from the bar; the
 * renderer recomputes that clearance for the chosen stroke width
 * (`lastSegment` tells it how).
 *
 * The anchor stays the end point, a cell centre like every loop's. At the
 * reference width the tangency point lies inside the last cell: one radius
 * plus the 2.4 clearance is under half a cell side on every square (6 of 13.3
 * on Saturn, 4.2 of 4.4 on the Moon).
 *
 * @param stroke - Path without consecutive duplicates, at least two points.
 * @param radius - Loop radius in frame units, at the reference width.
 * @returns The loop mark, anchored on the end point.
 */
function buildEndLoop(stroke: readonly Point[], radius: number): LoopMark {
  const end = stroke[stroke.length - 1] ?? ZERO;
  const beforeEnd = stroke[stroke.length - 2] ?? ZERO;
  const lastSegment = subtract(beforeEnd, end);
  const direction = unit(lastSegment);
  let side: Point = { x: -direction.y, y: direction.x };

  // Keep the loop off the side where the path came from before its last turn.
  const earlier = stroke[stroke.length - 3];
  if (earlier !== undefined && dot(side, subtract(earlier, beforeEnd)) > 0) {
    side = scale(side, -1);
  }

  return {
    kind: 'loop',
    anchor: end,
    center: placeEndLoop(end, lastSegment, side, radius, REFERENCE_STROKE_WIDTH),
    radius,
    lastSegment,
  };
}

/**
 * Places the end bar across the last point, perpendicular to the last segment.
 *
 * @param beforeEnd - Second-to-last point of the path, distinct from `end`.
 * @param end - Last point of the path.
 * @param barLength - Full bar length in frame units.
 * @returns The end bar mark, its angle in [0, 180) degrees.
 */
function buildEndBar(beforeEnd: Point, end: Point, barLength: number): EndBarMark {
  const segment = subtract(end, beforeEnd);
  const segmentAngle = (Math.atan2(segment.y, segment.x) * 180) / Math.PI;
  const angle = (((segmentAngle + 90) % 180) + 180) % 180;
  return { kind: 'end-bar', center: end, angle, length: barLength };
}

/**
 * Whether two points coincide. Cell centres are computed by the same formula,
 * so exact equality is reliable here.
 *
 * @param a - First point.
 * @param b - Second point.
 * @returns True when both coordinates are equal.
 */
function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Vector difference, used to get the direction from one point to another.
 *
 * @param a - Arrival point.
 * @param b - Departure point.
 * @returns The vector from `b` to `a`.
 */
function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

/**
 * Vector sum, used to move a point or to combine two directions.
 *
 * @param a - First vector or point.
 * @param b - Second vector.
 * @returns `a + b`.
 */
function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

/**
 * Multiplies a vector by a number.
 *
 * @param vector - Vector to scale.
 * @param factor - Multiplier; -1 flips the direction.
 * @returns The scaled vector.
 */
function scale(vector: Point, factor: number): Point {
  return { x: vector.x * factor, y: vector.y * factor };
}

/**
 * Dot product, positive when two vectors point to the same side.
 *
 * @param a - First vector.
 * @param b - Second vector.
 * @returns `a · b`.
 */
function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Euclidean length of a vector.
 *
 * @param vector - Vector to measure.
 * @returns Its length in frame units.
 */
function length(vector: Point): number {
  return Math.hypot(vector.x, vector.y);
}

/**
 * Normalises a vector to length 1.
 *
 * @param vector - Vector to normalise.
 * @returns A vector of length 1 in the same direction, or the null vector when
 *   `vector` is (nearly) null.
 */
function unit(vector: Point): Point {
  const size = length(vector);
  return size < EPSILON ? ZERO : scale(vector, 1 / size);
}
