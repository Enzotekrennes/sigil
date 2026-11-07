/**
 * Unit tests of the fitting inside the framing circle: no change when the
 * drawing already fits, a uniform shrink otherwise that leaves a visible gap,
 * and marks that keep their size and their contact with the path.
 */
import { describe, expect, it } from 'vitest';

import { fittedDrawing, frameFitScale, scaleDrawing } from './frameFit.ts';
import type { Drawing } from './frameFit.ts';
import { DEFAULT_STYLE_OPTIONS, FRAME_CIRCLE_RADIUS, scaleMark } from './style.ts';
import type { LoopMark, Point, Sigil } from './types.ts';

/** Centre of the 0–100 frame. */
const CENTER: Point = { x: 50, y: 50 };

/** Default stroke width. */
const WIDTH = 1.2;

/** A diagonal across the whole drawing square: its ends lie 56.6 from the centre. */
const CORNER_TO_CORNER: Drawing = {
  strokes: [
    [
      { x: 10, y: 10 },
      { x: 90, y: 90 },
    ],
  ],
  marks: [],
};

/**
 * Farthest outer edge of a drawing's strokes from the centre.
 *
 * @param drawing - Drawing to measure.
 * @param width - Stroke width.
 * @returns Largest point distance plus half a stroke.
 */
function strokeReach(drawing: Drawing, width: number): number {
  const distances = drawing.strokes.flat().map((p) => Math.hypot(p.x - 50, p.y - 50));
  return Math.max(...distances) + width / 2;
}

describe('frameFitScale', () => {
  it('leaves a drawing that already fits unchanged', () => {
    const small: Drawing = {
      strokes: [
        [
          { x: 40, y: 40 },
          { x: 60, y: 60 },
        ],
      ],
      marks: [],
    };

    expect(frameFitScale(small, WIDTH, CENTER)).toBe(1);
  });

  it('shrinks a drawing reaching the corners so it stays inside with a gap of two strokes', () => {
    const scale = frameFitScale(CORNER_TO_CORNER, WIDTH, CENTER);
    const fitted = scaleDrawing(CORNER_TO_CORNER, scale, CENTER);
    const innerEdge = FRAME_CIRCLE_RADIUS - WIDTH / 2;

    expect(scale).toBeLessThan(1);
    expect(strokeReach(fitted, WIDTH)).toBeLessThanOrEqual(innerEdge - 2 * WIDTH + 1e-6);
    // The largest factor that fits: the gap is exactly two strokes, not more.
    expect(strokeReach(fitted, WIDTH)).toBeCloseTo(innerEdge - 2 * WIDTH, 3);
  });

  it('keeps at least 2 units of gap with the thinnest stroke', () => {
    const width = 0.4;
    const fitted = scaleDrawing(
      CORNER_TO_CORNER,
      frameFitScale(CORNER_TO_CORNER, width, CENTER),
      CENTER,
    );

    expect(strokeReach(fitted, width)).toBeCloseTo(FRAME_CIRCLE_RADIUS - width / 2 - 2, 3);
  });

  it('counts the marks, sizes included, in the reach', () => {
    const withCircle: Drawing = {
      strokes: [
        [
          { x: 50, y: 50 },
          { x: 50, y: 95 },
        ],
      ],
      marks: [{ kind: 'start-circle', center: { x: 50, y: 95 }, radius: 3 }],
    };

    const scale = frameFitScale(withCircle, WIDTH, CENTER);
    const fitted = scaleDrawing(withCircle, scale, CENTER);
    const [circle] = fitted.marks;
    if (circle?.kind !== 'start-circle') throw new Error('Expected the start circle');

    expect(circle.radius).toBe(3);
    expect(circle.center.y - 50 + circle.radius + WIDTH / 2).toBeCloseTo(
      FRAME_CIRCLE_RADIUS - WIDTH / 2 - 2 * WIDTH,
      3,
    );
  });
});

describe('scaleDrawing', () => {
  it('moves points towards the centre and keeps the shape', () => {
    const fitted = scaleDrawing(CORNER_TO_CORNER, 0.5, CENTER);

    expect(fitted.strokes).toEqual([
      [
        { x: 30, y: 30 },
        { x: 70, y: 70 },
      ],
    ]);
  });

  it('keeps a loop tangent to the path: its centre moves with its anchor', () => {
    const drawing: Drawing = {
      strokes: [],
      marks: [{ kind: 'loop', anchor: { x: 90, y: 50 }, center: { x: 90, y: 46 }, radius: 4 }],
    };

    const [loop] = scaleDrawing(drawing, 0.5, CENTER).marks;

    expect(loop).toEqual({
      kind: 'loop',
      anchor: { x: 70, y: 50 },
      center: { x: 70, y: 46 },
      radius: 4,
    });
  });

  describe('loop of the last cell', () => {
    // End at (90, 50), path coming from (90, 70); loop beside the segment, 2.4 + 3 back.
    const endLoop: LoopMark = {
      kind: 'loop',
      anchor: { x: 90, y: 50 },
      center: { x: 93, y: 55.4 },
      radius: 3,
      lastSegment: { x: 0, y: 20 },
    };

    it('keeps its clearance from the end bar and its radius when the segment is long enough', () => {
      const [loop] = scaleDrawing({ strokes: [], marks: [endLoop] }, 0.5, CENTER).marks;

      expect(loop).toMatchObject({
        anchor: { x: 70, y: 50 },
        radius: 3,
        lastSegment: { x: 0, y: 10 },
      });
      if (loop?.kind !== 'loop') throw new Error('Expected a loop');
      expect(loop.center.x).toBeCloseTo(73, 9);
      expect(loop.center.y).toBeCloseTo(55.4, 9);
    });

    it('shrinks its radius to stay beside a segment shortened below its reach', () => {
      // At 0.25 the segment is 5 long: 2.4 of clearance leaves a radius of 2.6.
      const [loop] = scaleDrawing({ strokes: [], marks: [endLoop] }, 0.25, CENTER).marks;
      if (loop?.kind !== 'loop') throw new Error('Expected a loop');

      expect(loop.radius).toBeCloseTo(2.6, 9);
      expect(loop.center.y - loop.anchor.y).toBeCloseTo(5, 9);
      expect(loop.center.x - loop.anchor.x).toBeCloseTo(2.6, 9);
    });
  });

  it('returns the same drawing for a factor of 1', () => {
    expect(scaleDrawing(CORNER_TO_CORNER, 1, CENTER)).toBe(CORNER_TO_CORNER);
  });
});

describe('fittedDrawing', () => {
  /** A sigil crossing the whole drawing square, with a start circle and an end bar. */
  const sigil: Sigil = {
    strokes: CORNER_TO_CORNER.strokes,
    marks: [
      { kind: 'start-circle', center: { x: 10, y: 10 }, radius: 3 },
      { kind: 'end-bar', center: { x: 90, y: 90 }, angle: 135, length: 9.6 },
    ],
    viewBox: { x: 0, y: 0, width: 100, height: 100 },
    steps: [],
    seed: 0,
  };
  const thick = { ...DEFAULT_STYLE_OPTIONS, strokeWidth: 2.4 };

  it('resizes the marks to the stroke width and leaves the strokes when the circle is off', () => {
    const drawing = fittedDrawing(sigil, thick);

    expect(drawing.strokes).toEqual(sigil.strokes);
    expect(drawing.marks).toEqual(sigil.marks.map((mark) => scaleMark(mark, 2.4)));
  });

  it('fits the resized drawing inside the circle when it is on', () => {
    const framed = { ...thick, frameCircle: true };
    const resized = {
      strokes: sigil.strokes,
      marks: sigil.marks.map((mark) => scaleMark(mark, 2.4)),
    };
    const scale = frameFitScale(resized, 2.4, CENTER);

    expect(scale).toBeLessThan(1);
    expect(fittedDrawing(sigil, framed)).toEqual(scaleDrawing(resized, scale, CENTER));
  });

  it('ignores the circle in stencil mode, as the renderer does', () => {
    const stencil = { ...thick, frameCircle: true, mode: 'stencil' as const };

    expect(fittedDrawing(sigil, stencil)).toEqual(fittedDrawing(sigil, thick));
  });

  it('draws a part of the sigil at the size of the whole one', () => {
    const framed = { ...thick, frameCircle: true };
    const whole = fittedDrawing(sigil, framed);
    // The first half alone would fit the circle unshrunk; it must still follow the whole.
    const half = {
      strokes: [
        [
          { x: 10, y: 10 },
          { x: 50, y: 50 },
        ],
      ],
      marks: [],
    };
    const part = fittedDrawing(sigil, framed, half);

    expect(part.strokes[0]?.[0]).toEqual(whole.strokes[0]?.[0]);
    expect(part.strokes[0]?.[0]).not.toEqual({ x: 10, y: 10 });
    expect(part.marks).toEqual([]);
  });
});
