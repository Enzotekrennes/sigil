/**
 * Unit tests of the renderer style settings: defaults, stroke width range,
 * line ends, framing circle visibility and mark resizing.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STYLE_OPTIONS,
  endLoopClearance,
  frameCenter,
  lineEndsFor,
  MARK_REFERENCE_STROKE_WIDTH,
  loopSide,
  placeEndLoop,
  scaleMark,
  showsFrameCircle,
  snapStrokeWidth,
  STROKE_WIDTH_MAX,
  STROKE_WIDTH_MIN,
  STROKE_WIDTH_STEP,
  strokeWidthLevel,
} from './style.ts';
import type { LoopMark } from './types.ts';

describe('DEFAULT_STYLE_OPTIONS', () => {
  it('matches the design defaults: width 1.2, round ends, no frame, screen colours', () => {
    expect(DEFAULT_STYLE_OPTIONS).toEqual({
      strokeWidth: 1.2,
      roundEnds: true,
      frameCircle: false,
      mode: 'screen',
    });
  });
});

describe('lineEndsFor', () => {
  it('uses round caps and joins for round ends', () => {
    expect(lineEndsFor(true)).toEqual({ strokeLinecap: 'round', strokeLinejoin: 'round' });
  });

  it('uses butt caps and mitred joins limited to 4 otherwise', () => {
    expect(lineEndsFor(false)).toEqual({
      strokeLinecap: 'butt',
      strokeLinejoin: 'miter',
      strokeMiterlimit: 4,
    });
  });
});

describe('showsFrameCircle', () => {
  it('follows the setting in screen mode', () => {
    expect(showsFrameCircle({ ...DEFAULT_STYLE_OPTIONS, frameCircle: true })).toBe(true);
    expect(showsFrameCircle({ ...DEFAULT_STYLE_OPTIONS, frameCircle: false })).toBe(false);
  });

  it('never shows the decorative circle in stencil mode', () => {
    expect(showsFrameCircle({ ...DEFAULT_STYLE_OPTIONS, frameCircle: true, mode: 'stencil' })).toBe(
      false,
    );
  });
});

describe('frameCenter', () => {
  it('is the middle of the view box', () => {
    expect(frameCenter({ x: 0, y: 0, width: 100, height: 100 })).toEqual({ x: 50, y: 50 });
  });
});

describe('scaleMark', () => {
  it('leaves marks unchanged at the reference width', () => {
    const mark = { kind: 'start-circle', center: { x: 20, y: 30 }, radius: 3 } as const;

    expect(scaleMark(mark, MARK_REFERENCE_STROKE_WIDTH)).toEqual(mark);
  });

  it('scales the start circle radius with the stroke width', () => {
    const scaled = scaleMark(
      { kind: 'start-circle', center: { x: 20, y: 30 }, radius: 3 },
      MARK_REFERENCE_STROKE_WIDTH * 2,
    );

    expect(scaled).toEqual({ kind: 'start-circle', center: { x: 20, y: 30 }, radius: 6 });
  });

  it('scales the end bar length and keeps its centre and angle', () => {
    const scaled = scaleMark(
      { kind: 'end-bar', center: { x: 70, y: 70 }, angle: 45, length: 9.6 },
      MARK_REFERENCE_STROKE_WIDTH / 2,
    );

    expect(scaled).toEqual({ kind: 'end-bar', center: { x: 70, y: 70 }, angle: 45, length: 4.8 });
  });

  it('keeps a loop tangent to the path: same anchor, centre moved along the normal', () => {
    const loop: LoopMark = {
      kind: 'loop',
      anchor: { x: 50, y: 50 },
      center: { x: 50, y: 46.4 },
      radius: 3.6,
    };

    const scaled = scaleMark(loop, MARK_REFERENCE_STROKE_WIDTH * 3);
    if (scaled.kind !== 'loop') throw new Error('Expected a loop');

    expect(scaled.anchor).toEqual({ x: 50, y: 50 });
    expect(scaled.radius).toBeCloseTo(10.8);
    expect(scaled.center.x).toBeCloseTo(50);
    expect(scaled.center.y).toBeCloseTo(39.2);
    expect(
      Math.hypot(scaled.center.x - scaled.anchor.x, scaled.center.y - scaled.anchor.y),
    ).toBeCloseTo(scaled.radius);
  });

  it('stops circles and bars at the cap set by their method', () => {
    const start = scaleMark(
      { kind: 'start-circle', center: { x: 20, y: 30 }, radius: 3, maxRadius: 5 },
      MARK_REFERENCE_STROKE_WIDTH * 3,
    );
    const bar = scaleMark(
      { kind: 'end-bar', center: { x: 70, y: 70 }, angle: 0, length: 9.6, maxLength: 12 },
      MARK_REFERENCE_STROKE_WIDTH * 3,
    );

    expect(start).toMatchObject({ radius: 5 });
    expect(bar).toMatchObject({ length: 12 });
  });

  it('keeps a capped loop touching the path at its anchor', () => {
    const loop: LoopMark = {
      kind: 'loop',
      anchor: { x: 50, y: 50 },
      center: { x: 50, y: 46.4 },
      radius: 3.6,
      maxRadius: 6,
    };

    const scaled = scaleMark(loop, MARK_REFERENCE_STROKE_WIDTH * 3);

    expect(scaled).toMatchObject({ radius: 6, center: { x: 50, y: 44 } });
  });

  describe('loop of the last cell', () => {
    // Path arriving at (50, 50) from (50, 70): the last segment points down from the end.
    const end = { x: 50, y: 50 };
    const lastSegment = { x: 0, y: 20 };
    const side = { x: 1, y: 0 };
    const loop: LoopMark = {
      kind: 'loop',
      anchor: end,
      center: placeEndLoop(end, lastSegment, side, 3, MARK_REFERENCE_STROKE_WIDTH),
      radius: 3,
      lastSegment,
    };

    it('touches the last segment back from the end by its radius plus the clearance', () => {
      expect(loop.center.x).toBeCloseTo(53, 9);
      expect(loop.center.y).toBeCloseTo(50 + 3 + 2.4, 9);
    });

    it.each([0.4, 1.2, 2, 4])(
      'keeps a gap of min(width, 1.2) to the bar at width %s',
      (strokeWidth) => {
        const scaled = scaleMark(loop, strokeWidth);
        if (scaled.kind !== 'loop') throw new Error('Expected a loop');
        // The bar lies on the line y = 50: the loop edge is radius away from its centre.
        const gap = scaled.center.y - scaled.radius - end.y - strokeWidth;
        expect(gap).toBeCloseTo(Math.min(strokeWidth, 1.2), 9);
        expect(scaled.center.x - end.x).toBeCloseTo(scaled.radius, 9);
        expect(scaled.anchor).toEqual(end);
      },
    );

    it('keeps the loop on its side of the segment', () => {
      const right = loopSide(lastSegment, { x: 3, y: 5.4 });
      const left = loopSide(lastSegment, { x: -3, y: 5.4 });
      expect([right.x, right.y + 0]).toEqual([1, 0]);
      expect([left.x, left.y + 0]).toEqual([-1, 0]);
    });
  });
});

describe('endLoopClearance', () => {
  it('is one stroke width for the touching strokes plus a gap capped at 1.2', () => {
    expect(endLoopClearance(0.4)).toBeCloseTo(0.8, 9);
    expect(endLoopClearance(1.2)).toBeCloseTo(2.4, 9);
    expect(endLoopClearance(4)).toBeCloseTo(5.2, 9);
  });
});

describe('stroke width setting', () => {
  it('spans the design range 4–40 by 2 (0.4–4 by 0.2 in the 0–100 frame)', () => {
    expect([STROKE_WIDTH_MIN, STROKE_WIDTH_MAX, STROKE_WIDTH_STEP]).toEqual([0.4, 4, 0.2]);
    expect(DEFAULT_STYLE_OPTIONS.strokeWidth).toBe(snapStrokeWidth(1.2));
  });

  it('snaps a slider value to the step without floating point noise', () => {
    expect(snapStrokeWidth(1.4000000000000001)).toBe(1.4);
    expect(snapStrokeWidth(0.2 * 7)).toBe(1.4);
    expect(snapStrokeWidth(1.29)).toBe(1.2);
    expect(snapStrokeWidth(1.31)).toBe(1.4);
  });

  it('clamps to the range and falls back to the default for NaN', () => {
    expect(snapStrokeWidth(0)).toBe(0.4);
    expect(snapStrokeWidth(12)).toBe(4);
    expect(snapStrokeWidth(Number.NaN)).toBe(1.2);
  });

  it('names thin up to 1.4, medium up to 2.6, thick above', () => {
    expect(strokeWidthLevel(0.4)).toBe('thin');
    expect(strokeWidthLevel(1.2)).toBe('thin');
    expect(strokeWidthLevel(1.4)).toBe('thin');
    expect(strokeWidthLevel(1.6)).toBe('medium');
    expect(strokeWidthLevel(2.6)).toBe('medium');
    expect(strokeWidthLevel(2.8)).toBe('thick');
    expect(strokeWidthLevel(4)).toBe('thick');
  });
});
