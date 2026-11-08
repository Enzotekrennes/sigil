/**
 * Angular letter skeletons of the Spare method (plan decision D20): every
 * curve of a Hershey capital is redrawn as two to four straight segments, so
 * that the letters bind into a rune made of straight strokes only. S becomes
 * a zigzag, O a diamond, C a bracket, the bowls of B D P R triangles.
 *
 * Exposes `angularStrokes` (the pure redrawing of any glyph's strokes),
 * `getAngularGlyph` (the 26 letters, computed once) and the tolerances. Works
 * in the glyph frame of `glyphs/types.ts` (Hershey units, y downwards from the
 * baseline). Does not place, scale or mirror letters: the rune composition does.
 */
import type { Box, Point } from '../sigil/types.ts';
import { getGlyph } from './glyphs/index.ts';
import type { CapitalLetter } from './glyphs/index.ts';

/**
 * Douglas-Peucker tolerance on curves, as a share of the glyph's cap height
 * (21 Hershey units): about 2.5 units. Strong on purpose: a Hershey bowl
 * deviates from its chord by 7 units and keeps its apex, while the gentle
 * bends between apexes (2–2.5 units) are dropped, leaving 2 to 4 segments.
 */
export const CURVE_TOLERANCE_RATIO = 0.12;

/**
 * Letters whose curve needs another tolerance, as a share of the cap height.
 * The S of Hershey ends in a hook that deviates 4.8 units from the zigzag
 * through its two bends, more than the U's corners (4.1 units) that the
 * default tolerance must keep: at 0.25 (5.25 units) the S drops its hooks
 * and becomes the three-stroke zigzag of a cut rune.
 */
export const CURVE_TOLERANCE_OVERRIDES: Readonly<Partial<Record<CapitalLetter, number>>> = {
  S: 0.25,
};

/** Fewest straight segments a curve is redrawn with: one would erase the bend. */
export const MIN_CURVE_SEGMENTS = 2;

/** Most straight segments a curve is redrawn with (decision D20). */
export const MAX_CURVE_SEGMENTS = 4;

/**
 * Distance, as a share of the glyph's width (x) or height (y), under which a
 * corner created by the simplification snaps onto a key line of the glyph
 * box: left side, centre or right side; top, quarter, middle, three-quarter
 * or bottom. Hershey curves are slightly lopsided (a U whose bottom is one
 * unit left of centre, an S whose bends are not opposite); snapping makes
 * diamonds, triangles and zigzags regular, as cut runes are. The quarter
 * lines are 0.25 apart, so every movable corner lands on one of them in y.
 */
export const KEY_LINE_SNAP_RATIO = 0.15;

/**
 * Smallest vertical gap between the two ends of a bowl, as a share of its
 * height. The bowls of B, D, P, R and the C open over half their height or
 * more; the G, whose curve comes back up to its short bar, opens over 38 %
 * and stays a hooked curve instead of becoming a triangle.
 */
export const MIN_BOWL_OPENING = 0.5;

/**
 * Largest angle, in degrees, between a simplified segment and the vertical
 * or horizontal for it to be straightened onto that axis. Under that angle a
 * stroke reads as an unsteady vertical or horizontal rather than as a slant.
 */
export const STRAIGHTEN_ANGLE = 8;

/** Height of a capital in the glyph frame (cap top at −21, baseline at 0). */
const CAP_HEIGHT = 21;

/** Distance under which two points of a glyph count as the same, in Hershey units. */
const SAME_POINT = 1e-6;

/** A letter redrawn with straight segments, in the glyph frame. */
export interface AngularGlyph {
  /** Polylines in drawing order; every segment is straight and of positive length. */
  readonly strokes: readonly (readonly Point[])[];
  /** Tight bounding box of every point. */
  readonly bounds: Box;
}

/** A vertex of a simplified stroke, with whether the simplification created it. */
interface Vertex {
  x: number;
  y: number;
  /** True for a corner kept from inside a curve, free to snap and straighten. */
  readonly movable: boolean;
}

/**
 * Redraws a glyph's strokes with straight segments only: strokes of two
 * points are kept; a closed curve (first point equal to the last) becomes
 * the diamond through its four extreme points; any other stroke of three
 * points or more is first extended along a bar it ends on when that closes
 * it into a bowl; a bowl (both ends on one vertical, bulging to one side,
 * open over `MIN_BOWL_OPENING` of its height) becomes a triangle; any other
 * curve is simplified with Douglas-Peucker at `toleranceRatio` × cap height,
 * its tolerance raised until it has at most `MAX_CURVE_SEGMENTS` segments and
 * its farthest point kept so that it has at least `MIN_CURVE_SEGMENTS`. The
 * corners created inside a curve then snap onto the key lines of the glyph
 * box and, when a segment is within `STRAIGHTEN_ANGLE` of an axis, onto that
 * axis. Finally the ends of straight strokes that stood on a curve are moved
 * onto the redrawn curve.
 *
 * @param strokes - Polylines of one glyph in the glyph frame, each of at
 *   least two points.
 * @param toleranceRatio - Douglas-Peucker tolerance as a share of the cap
 *   height (21 units); `CURVE_TOLERANCE_RATIO` by default.
 * @returns New polylines, same count and order, straight segments only. The
 *   ends of curves never move; the ends of straight strokes move only to
 *   stay on a redrawn curve, so letters stay connected where strokes meet.
 */
export function angularStrokes(
  strokes: readonly (readonly Point[])[],
  toleranceRatio = CURVE_TOLERANCE_RATIO,
): Point[][] {
  const box = boundsOf(strokes.flat());
  const redrawn = closeBowls(strokes).map((stroke) => {
    if (stroke.length <= 2) return stroke.map(({ x, y }) => ({ x, y }));
    let vertices: Vertex[];
    if (isClosed(stroke)) vertices = diamondOf(stroke);
    else if (isBowl(stroke)) vertices = triangleOf(stroke);
    else vertices = simplifyCurve(stroke, toleranceRatio);
    snapToKeyLines(vertices, box);
    straighten(vertices);
    return dropRepeats(vertices.map(({ x, y }) => ({ x, y })));
  });
  reattach(strokes, redrawn);
  return redrawn;
}

/** Angular skeletons computed once, on first use. */
const angularGlyphs = new Map<CapitalLetter, AngularGlyph>();

/**
 * Gives the angular skeleton of a letter (see `angularStrokes`).
 *
 * @param letter - One upper-case letter A–Z.
 * @returns Its straight-segment strokes and their bounding box, in the glyph
 *   frame. The returned data is shared and must not be modified.
 */
export function getAngularGlyph(letter: CapitalLetter): AngularGlyph {
  const cached = angularGlyphs.get(letter);
  if (cached !== undefined) return cached;
  const strokes = angularStrokes(
    getGlyph(letter).strokes,
    CURVE_TOLERANCE_OVERRIDES[letter] ?? CURVE_TOLERANCE_RATIO,
  );
  const glyph = { strokes, bounds: boundsOf(strokes.flat()) };
  angularGlyphs.set(letter, glyph);
  return glyph;
}

/**
 * Whether a stroke ends where it starts (the bowl of O and Q).
 *
 * @param stroke - Polyline of at least two points.
 * @returns True when its first and last points coincide.
 */
function isClosed(stroke: readonly Point[]): boolean {
  const first = stroke[0];
  const last = stroke[stroke.length - 1];
  return (
    first !== undefined &&
    last !== undefined &&
    Math.abs(first.x - last.x) < SAME_POINT &&
    Math.abs(first.y - last.y) < SAME_POINT
  );
}

/**
 * Diamond of a closed curve: the middle of its topmost, rightmost, bottommost
 * and leftmost points, joined in that order and closed. Douglas-Peucker has
 * no chord on a closed curve; its four extremes are where a cut rune puts
 * the corners of an O.
 *
 * @param stroke - Closed polyline.
 * @returns Five vertices (the first repeated at the end), all movable.
 */
function diamondOf(stroke: readonly Point[]): Vertex[] {
  const box = boundsOf(stroke);
  const middleOf = (points: readonly Point[], axis: 'x' | 'y'): number => {
    const values = points.map((point) => point[axis]);
    return (Math.min(...values) + Math.max(...values)) / 2;
  };
  const on = (axis: 'x' | 'y', value: number): Point[] =>
    stroke.filter((point) => Math.abs(point[axis] - value) < SAME_POINT);
  const top = { x: middleOf(on('y', box.y), 'x'), y: box.y, movable: true };
  const right = {
    x: box.x + box.width,
    y: middleOf(on('x', box.x + box.width), 'y'),
    movable: true,
  };
  const bottom = {
    x: middleOf(on('y', box.y + box.height), 'x'),
    y: box.y + box.height,
    movable: true,
  };
  const left = { x: box.x, y: middleOf(on('x', box.x), 'y'), movable: true };
  return [top, right, bottom, left, top];
}

/**
 * Extends each curve that ends on a straight bar of another stroke along
 * that bar, when this brings it back to the vertical its other end stands
 * on. The upper bowl of the Hershey B stops at the end of the middle bar;
 * extended back to the stem, it becomes a bowl like those of D, P and R.
 *
 * @param strokes - Polylines of one glyph.
 * @returns The same polylines, some curves one point longer.
 */
function closeBowls(strokes: readonly (readonly Point[])[]): (readonly Point[])[] {
  return strokes.map((stroke) => {
    const first = stroke[0];
    const last = stroke[stroke.length - 1];
    if (stroke.length <= 2 || first === undefined || last === undefined) return stroke;
    if (Math.abs(first.x - last.x) < SAME_POINT) return stroke;
    for (const other of strokes) {
      if (other === stroke) continue;
      for (let index = 1; index < other.length; index += 1) {
        const a = other[index - 1];
        const b = other[index];
        if (a === undefined || b === undefined || Math.abs(a.y - b.y) >= SAME_POINT) continue;
        for (const [end, back] of [
          [a, b],
          [b, a],
        ] as const) {
          if (samePoint(end, last) && Math.abs(back.x - first.x) < SAME_POINT) {
            return [...stroke, back];
          }
        }
      }
    }
    return stroke;
  });
}

/**
 * Whether an open curve is a bowl: it starts and ends on the same vertical
 * and bulges to one side of it only (the bowls of B, D, P and R).
 *
 * @param stroke - Open polyline of at least three points.
 * @returns True for a bowl.
 */
function isBowl(stroke: readonly Point[]): boolean {
  const first = stroke[0];
  const last = stroke[stroke.length - 1];
  if (first === undefined || last === undefined) return false;
  if (Math.abs(first.x - last.x) >= SAME_POINT) return false;
  const sides = stroke.map((point) => Math.sign(Math.round((point.x - first.x) / SAME_POINT)));
  if (sides.includes(1) && sides.includes(-1)) return false;
  const ys = stroke.map((point) => point.y);
  const height = Math.max(...ys) - Math.min(...ys);
  return Math.abs(last.y - first.y) >= MIN_BOWL_OPENING * height;
}

/**
 * Triangle of a bowl: its two ends joined through the middle of its farthest
 * points from the vertical they stand on, the bowl of the thorn and raido runes.
 *
 * @param stroke - A bowl (see `isBowl`).
 * @returns Three vertices; only the apex is movable.
 */
function triangleOf(stroke: readonly Point[]): Vertex[] {
  const first = stroke[0] ?? { x: 0, y: 0 };
  const last = stroke[stroke.length - 1] ?? first;
  const reach = Math.max(...stroke.map((point) => Math.abs(point.x - first.x)));
  const farthest = stroke.filter(
    (point) => Math.abs(Math.abs(point.x - first.x) - reach) < SAME_POINT,
  );
  const ys = farthest.map((point) => point.y);
  const apexX = farthest[0]?.x ?? first.x;
  return [
    { x: first.x, y: first.y, movable: false },
    { x: apexX, y: (Math.min(...ys) + Math.max(...ys)) / 2, movable: true },
    { x: last.x, y: last.y, movable: false },
  ];
}

/**
 * Moves the ends of straight strokes that stood on a curve onto the redrawn
 * curve, at the nearest point, so that a joint survives the redrawing (the
 * leg of R starts on its bowl).
 *
 * @param original - Polylines before redrawing.
 * @param redrawn - Polylines after redrawing, same count and order; modified in place.
 */
function reattach(original: readonly (readonly Point[])[], redrawn: Point[][]): void {
  redrawn.forEach((stroke, strokeIndex) => {
    if ((original[strokeIndex]?.length ?? 0) > 2) return;
    stroke.forEach((point, pointIndex) => {
      original.forEach((curve, curveIndex) => {
        if (curveIndex === strokeIndex || curve.length <= 2) return;
        const target = redrawn[curveIndex];
        if (target === undefined || !liesOn(point, curve) || liesOn(point, target)) return;
        stroke[pointIndex] = nearestOn(point, target);
      });
    });
  });
}

/**
 * Whether a point lies on a polyline, within `SAME_POINT`.
 *
 * @param point - Point tested.
 * @param polyline - Polyline of at least two points.
 * @returns True when the point is on one of its segments.
 */
function liesOn(point: Point, polyline: readonly Point[]): boolean {
  return distanceTo(point, polyline) < SAME_POINT;
}

/**
 * Distance from a point to a polyline.
 *
 * @param point - Point measured.
 * @param polyline - Polyline of at least two points.
 * @returns The smallest distance to one of its segments.
 */
function distanceTo(point: Point, polyline: readonly Point[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < polyline.length; index += 1) {
    best = Math.min(best, chordDistance(point, polyline[index - 1], polyline[index]));
  }
  return best;
}

/**
 * Nearest point of a polyline.
 *
 * @param point - Point projected.
 * @param polyline - Polyline of at least two points.
 * @returns The point of the polyline closest to `point`.
 */
function nearestOn(point: Point, polyline: readonly Point[]): Point {
  let best = point;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < polyline.length; index += 1) {
    const start = polyline[index - 1];
    const end = polyline[index];
    if (start === undefined || end === undefined) continue;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const t =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
          );
    const candidate = { x: start.x + t * dx, y: start.y + t * dy };
    const gap = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (gap < bestDistance) {
      best = candidate;
      bestDistance = gap;
    }
  }
  return best;
}

/**
 * Whether two points coincide, within `SAME_POINT`.
 *
 * @param a - First point.
 * @param b - Second point.
 * @returns True when they are the same point.
 */
function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < SAME_POINT && Math.abs(a.y - b.y) < SAME_POINT;
}

/**
 * Simplifies an open curve to 2–4 segments (see `angularStrokes`).
 *
 * @param stroke - Open polyline of at least three points.
 * @param toleranceRatio - Starting tolerance, as a share of the cap height.
 * @returns Its kept vertices in order; the two endpoints are not movable.
 */
function simplifyCurve(stroke: readonly Point[], toleranceRatio: number): Vertex[] {
  let tolerance = toleranceRatio * CAP_HEIGHT;
  let kept = douglasPeucker(stroke, tolerance);
  while (kept.length - 1 > MAX_CURVE_SEGMENTS) {
    tolerance *= 1.25;
    kept = douglasPeucker(stroke, tolerance);
  }
  if (kept.length - 1 < MIN_CURVE_SEGMENTS) kept = douglasPeucker(stroke, 0, 1);
  const last = stroke.length - 1;
  return kept.map((index) => {
    const point = stroke[index] ?? { x: 0, y: 0 };
    return { x: point.x, y: point.y, movable: index !== 0 && index !== last };
  });
}

/**
 * Douglas-Peucker simplification: keeps the point farthest from the chord
 * when it deviates more than the tolerance, and recurses on both halves.
 *
 * @param points - Polyline of at least two points.
 * @param tolerance - Largest deviation dropped, in glyph units.
 * @param maxDepth - Recursion levels allowed; one level keeps only the
 *   farthest point. Unlimited by default.
 * @returns Indices of the kept points, in order, both endpoints included.
 */
function douglasPeucker(
  points: readonly Point[],
  tolerance: number,
  maxDepth = Number.POSITIVE_INFINITY,
): number[] {
  const kept = new Set<number>([0, points.length - 1]);
  const visit = (from: number, to: number, depth: number): void => {
    if (to - from < 2 || depth >= maxDepth) return;
    let farthest = from;
    let farthestDistance = -1;
    for (let index = from + 1; index < to; index += 1) {
      const deviation = chordDistance(points[index], points[from], points[to]);
      if (deviation > farthestDistance) {
        farthest = index;
        farthestDistance = deviation;
      }
    }
    if (farthestDistance <= tolerance) return;
    kept.add(farthest);
    visit(from, farthest, depth + 1);
    visit(farthest, to, depth + 1);
  };
  visit(0, points.length - 1, 0);
  return [...kept].sort((a, b) => a - b);
}

/**
 * Distance from a point to the segment between two others.
 *
 * @param point - Point measured; `undefined` counts as no deviation.
 * @param start - First end of the chord.
 * @param end - Second end of the chord.
 * @returns The distance in glyph units.
 */
function chordDistance(
  point: Point | undefined,
  start: Point | undefined,
  end: Point | undefined,
): number {
  if (point === undefined || start === undefined || end === undefined) return 0;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
        );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

/**
 * Moves the movable vertices lying near a key line of the glyph box onto it.
 *
 * @param vertices - Vertices of one stroke, modified in place.
 * @param box - Bounding box of the whole glyph.
 */
function snapToKeyLines(vertices: Vertex[], box: Box): void {
  const xs = [box.x, box.x + box.width / 2, box.x + box.width];
  const ys = [0, 0.25, 0.5, 0.75, 1].map((share) => box.y + share * box.height);
  const snap = (value: number, lines: readonly number[], span: number): number => {
    let best = value;
    let bestGap = KEY_LINE_SNAP_RATIO * span;
    for (const line of lines) {
      const gap = Math.abs(line - value);
      if (gap <= bestGap) {
        best = line;
        bestGap = gap;
      }
    }
    return best;
  };
  for (const vertex of vertices) {
    if (!vertex.movable) continue;
    vertex.x = snap(vertex.x, xs, box.width);
    vertex.y = snap(vertex.y, ys, box.height);
  }
}

/**
 * Turns segments within `STRAIGHTEN_ANGLE` of the vertical or the horizontal
 * into exact verticals or horizontals, by moving their movable end (both ends
 * to their middle when both are movable; none when neither is).
 *
 * @param vertices - Vertices of one stroke, modified in place.
 */
function straighten(vertices: Vertex[]): void {
  const limit = Math.tan((STRAIGHTEN_ANGLE * Math.PI) / 180);
  for (let index = 1; index < vertices.length; index += 1) {
    const start = vertices[index - 1];
    const end = vertices[index];
    if (start === undefined || end === undefined) continue;
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    if (dx > 0 && dx <= limit * dy) alignAxis(start, end, 'x');
    else if (dy > 0 && dy <= limit * dx) alignAxis(start, end, 'y');
  }
}

/**
 * Gives two vertices the same coordinate on one axis, moving only movable ones.
 *
 * @param a - First vertex, modified in place.
 * @param b - Second vertex, modified in place.
 * @param axis - Coordinate to equalise.
 */
function alignAxis(a: Vertex, b: Vertex, axis: 'x' | 'y'): void {
  if (a.movable && b.movable) {
    const middle = (a[axis] + b[axis]) / 2;
    a[axis] = middle;
    b[axis] = middle;
  } else if (a.movable) {
    a[axis] = b[axis];
  } else if (b.movable) {
    b[axis] = a[axis];
  }
}

/**
 * Removes consecutive points that coincide after snapping.
 *
 * @param points - Polyline.
 * @returns The polyline without zero-length segments.
 */
function dropRepeats(points: readonly Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (
      last === undefined ||
      Math.abs(last.x - point.x) >= SAME_POINT ||
      Math.abs(last.y - point.y) >= SAME_POINT
    ) {
      result.push(point);
    }
  }
  return result;
}

/**
 * Tight bounding box of points.
 *
 * @param points - At least one point.
 * @returns The box; a zero box when there is no point.
 */
function boundsOf(points: readonly Point[]): Box {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
