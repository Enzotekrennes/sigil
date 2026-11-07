/**
 * Builds a sigil with the magic square (kamea) method.
 *
 * Letters → numbers (decision D2) → centres of the matching cells of the
 * planet's square → one polyline, with a circle at the start, a bar
 * perpendicular to the last segment at the end, and a loop wherever the same
 * number comes several times in a row (decision D3). Also produces the
 * explanation steps. Pure and deterministic: no randomness, no I/O.
 * Does not normalise the intention: letters arrive already reduced to A–Z.
 */
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
import { KAMEA_SQUARES } from './squares.ts';

/** Side of the normalised square frame shared by every sigil. */
const FRAME_SIZE = 100;

/**
 * Empty band around the grid, so that marks near the border stay inside the
 * frame. Same 10 % as the design's 800-in-1000 drawing area.
 */
const GRID_MARGIN = 10;

/** Side of the grid the path is drawn on. */
const GRID_SIZE = FRAME_SIZE - 2 * GRID_MARGIN;

/**
 * Default stroke width in frame units: the design's default of 12 in a
 * 1000-unit frame. Mark sizes are expressed as multiples of it, as in the
 * "Sigil stroke" section of the design document.
 */
const REFERENCE_STROKE_WIDTH = 1.2;

/** Start circle radius: 2.5 stroke widths, large enough to read as hollow. */
const START_CIRCLE_RADIUS = 2.5 * REFERENCE_STROKE_WIDTH;

/** End bar length: 8 stroke widths, clearly longer than the line is thick. */
const END_BAR_LENGTH = 8 * REFERENCE_STROKE_WIDTH;

/** Loop radius: 3 stroke widths, slightly larger than the start circle to tell them apart. */
const LOOP_RADIUS = 3 * REFERENCE_STROKE_WIDTH;

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
  | { readonly code: 'TOO_FEW_LETTERS'; readonly letterCount: number }
  /** A letter outside A–Z reached the method (normalisation was skipped). */
  | { readonly code: 'INVALID_LETTER'; readonly letter: string; readonly index: number }
  /** Every letter falls on the same cell: the path would be a single point. */
  | { readonly code: 'SINGLE_CELL'; readonly number: number };

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
  const visited = cells.map((cell) => cellCenter(cell, order));
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
      marks: buildMarks(stroke, numbers, visited),
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
 * Centre of a cell once the grid is laid in the frame, inside its margin.
 *
 * @param cell - Zero-based cell.
 * @param order - Side N of the square.
 * @returns The centre in frame units.
 */
function cellCenter(cell: GridCell, order: number): Point {
  const cellSize = GRID_SIZE / order;
  return {
    x: GRID_MARGIN + (cell.column + 0.5) * cellSize,
    y: GRID_MARGIN + (cell.row + 0.5) * cellSize,
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
 * Builds the start circle, the end bar and one loop per run of repeated numbers.
 *
 * @param stroke - Path without consecutive duplicates, at least two points.
 * @param numbers - Numbers visited, one per letter.
 * @param visited - Cell centre of each number, same length as `numbers`.
 * @returns Marks in drawing order: start, loops along the path, end.
 */
function buildMarks(
  stroke: readonly Point[],
  numbers: readonly number[],
  visited: readonly Point[],
): Mark[] {
  const start = stroke[0];
  const end = stroke[stroke.length - 1];
  const beforeEnd = stroke[stroke.length - 2];
  if (start === undefined || end === undefined || beforeEnd === undefined) return [];

  const marks: Mark[] = [{ kind: 'start-circle', center: start, radius: START_CIRCLE_RADIUS }];
  for (const [index, point] of visited.entries()) {
    const startsRun =
      numbers[index] === numbers[index + 1] && numbers[index] !== numbers[index - 1];
    if (!startsRun) continue;
    const previous = findDistinct(visited, index, -1);
    const next = findDistinct(visited, index, 1);
    marks.push(buildLoop(point, previous, next));
  }
  marks.push(buildEndBar(beforeEnd, end));
  return marks;
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
 * @returns The loop mark.
 */
function buildLoop(anchor: Point, previous: Point | undefined, next: Point | undefined): LoopMark {
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
    center: add(anchor, scale(normal, LOOP_RADIUS)),
    radius: LOOP_RADIUS,
  };
}

/**
 * Places the end bar across the last point, perpendicular to the last segment.
 *
 * @param beforeEnd - Second-to-last point of the path, distinct from `end`.
 * @param end - Last point of the path.
 * @returns The end bar mark, its angle in [0, 180) degrees.
 */
function buildEndBar(beforeEnd: Point, end: Point): EndBarMark {
  const segment = subtract(end, beforeEnd);
  const segmentAngle = (Math.atan2(segment.y, segment.x) * 180) / Math.PI;
  const angle = (((segmentAngle + 90) % 180) + 180) % 180;
  return { kind: 'end-bar', center: end, angle, length: END_BAR_LENGTH };
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
