/**
 * Tests of the neutral export file name (decision D8): method and local
 * timestamp only, zero-padded.
 */
import { describe, expect, it } from 'vitest';

import { exportFileName } from './fileName.ts';

describe('exportFileName', () => {
  it('names a kamea SVG with the method and the local date and time', () => {
    const date = new Date(2026, 10, 8, 15, 30, 12);

    expect(exportFileName('kamea', 'svg', date)).toBe('sigil-kamea-20261108-153012.svg');
  });

  it('pads single-digit months, days and times', () => {
    const date = new Date(2027, 0, 2, 3, 4, 5);

    expect(exportFileName('spare', 'png', date)).toBe('sigil-spare-20270102-030405.png');
  });

  it('only ever contains the fixed pattern', () => {
    const name = exportFileName('spare', 'svg', new Date());

    expect(name).toMatch(/^sigil-spare-\d{8}-\d{6}\.svg$/);
  });
});
