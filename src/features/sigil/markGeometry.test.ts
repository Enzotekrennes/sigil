/**
 * Unit tests of the mark geometry shared by the methods and the renderer: the
 * clearance of the end loop from the end bar, its placement beside the last
 * segment, and the side of the segment it stays on.
 */
import { describe, expect, it } from 'vitest';

import { MARK_REFERENCE_STROKE_WIDTH } from './frame.ts';
import { endLoopClearance, loopSide, placeEndLoop } from './markGeometry.ts';
import { STROKE_WIDTH_MAX, STROKE_WIDTH_MIN } from './style.ts';

describe('endLoopClearance', () => {
  it('is one stroke width for the touching strokes plus a gap capped at 1.2', () => {
    expect(endLoopClearance(STROKE_WIDTH_MIN)).toBeCloseTo(0.8, 9);
    expect(endLoopClearance(MARK_REFERENCE_STROKE_WIDTH)).toBeCloseTo(2.4, 9);
    expect(endLoopClearance(STROKE_WIDTH_MAX)).toBeCloseTo(3.6, 9);
    // Beyond the setting's range, the gap stays capped.
    expect(endLoopClearance(4)).toBeCloseTo(5.2, 9);
  });
});

describe('placeEndLoop', () => {
  it('moves the loop back from the end by its radius plus the clearance, then aside by its radius', () => {
    // Path arriving at (50, 50) from (50, 70): the last segment points down from the end.
    const center = placeEndLoop({ x: 50, y: 50 }, { x: 0, y: 20 }, { x: -1, y: 0 }, 2, 0.4);
    expect(center.x).toBeCloseTo(48, 9);
    expect(center.y).toBeCloseTo(50 + 2 + 0.8, 9);
  });
});

describe('loopSide', () => {
  it('keeps the loop on its side of the segment', () => {
    const lastSegment = { x: 0, y: 20 };
    const right = loopSide(lastSegment, { x: 3, y: 5.4 });
    const left = loopSide(lastSegment, { x: -3, y: 5.4 });
    expect([right.x, right.y + 0]).toEqual([1, 0]);
    expect([left.x, left.y + 0]).toEqual([-1, 0]);
  });
});
