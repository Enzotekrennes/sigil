/**
 * Unit tests of the sigil geometry: coordinate formatting, path data,
 * polyline lengths, tracing schedule and end bar placement.
 */
import { describe, expect, it } from 'vitest';

import {
  endBarEndpoints,
  formatCoordinate,
  polylineLength,
  polylinePathData,
  traceSchedule,
} from './geometry.ts';
import type { EndBarMark } from './types.ts';

describe('formatCoordinate', () => {
  it('rounds to three decimals and drops trailing zeros', () => {
    expect(formatCoordinate(23.333333)).toBe('23.333');
    expect(formatCoordinate(50)).toBe('50');
    expect(formatCoordinate(1.2)).toBe('1.2');
  });

  it('never writes a negative zero', () => {
    expect(formatCoordinate(-0.0001)).toBe('0');
  });
});

describe('polylinePathData', () => {
  it('writes one move-to then one line-to per following point', () => {
    const d = polylinePathData([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50.5, y: 60 },
    ]);

    expect(d).toBe('M10 20L30 40L50.5 60');
  });

  it('returns an empty string for an empty polyline', () => {
    expect(polylinePathData([])).toBe('');
  });
});

describe('polylineLength', () => {
  it('measures a single segment (3-4-5 triangle)', () => {
    expect(
      polylineLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ]),
    ).toBe(5);
  });

  it('sums the segments of a broken line', () => {
    const length = polylineLength([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);

    expect(length).toBe(30);
  });

  it('counts a back-and-forth twice', () => {
    expect(
      polylineLength([
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ]),
    ).toBe(20);
  });

  it('is 0 for fewer than two points', () => {
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([{ x: 5, y: 5 }])).toBe(0);
  });
});

describe('traceSchedule', () => {
  it('gives a single stroke the whole tracing time', () => {
    expect(
      traceSchedule([
        [
          { x: 0, y: 0 },
          { x: 0, y: 7 },
        ],
      ]),
    ).toEqual([{ share: 1, offset: 0, penLiftsBefore: 0 }]);
  });

  it('splits the time by length, in tracing order', () => {
    const schedule = traceSchedule([
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
      ],
    ]);

    expect(schedule).toEqual([
      { share: 0.25, offset: 0, penLiftsBefore: 0 },
      { share: 0.75, offset: 0.25, penLiftsBefore: 1 },
    ]);
  });

  it('shares the time equally when every stroke has zero length', () => {
    const schedule = traceSchedule([[{ x: 1, y: 1 }], [{ x: 2, y: 2 }]]);

    expect(schedule.map((timing) => timing.share)).toEqual([0.5, 0.5]);
    expect(schedule.map((timing) => timing.offset)).toEqual([0, 0.5]);
  });

  it('returns no timing for a sigil without strokes', () => {
    expect(traceSchedule([])).toEqual([]);
  });
});

describe('endBarEndpoints', () => {
  it('centres a horizontal bar on its centre', () => {
    const bar: EndBarMark = { kind: 'end-bar', center: { x: 50, y: 50 }, angle: 0, length: 10 };

    expect(endBarEndpoints(bar, 10)).toEqual([
      { x: 45, y: 50 },
      { x: 55, y: 50 },
    ]);
  });

  it('follows the angle, measured towards positive y', () => {
    const bar: EndBarMark = { kind: 'end-bar', center: { x: 50, y: 50 }, angle: 90, length: 10 };
    const [from, to] = endBarEndpoints(bar, 20);

    expect(from.x).toBeCloseTo(50);
    expect(from.y).toBeCloseTo(40);
    expect(to.x).toBeCloseTo(50);
    expect(to.y).toBeCloseTo(60);
  });
});
