/**
 * Unit tests of the Hershey `.jhf` conversion: parsing, decoding, refusal of
 * malformed or unexpected input, and idempotent regeneration of the
 * committed module.
 */
import { describe, expect, it } from 'vitest';

import {
  convertRomanSimplexCapitals,
  decodeHersheyRecord,
  generateRomanSimplexModule,
  parseJhfRecords,
} from './hersheyConversion.ts';
import { ROMAN_SIMPLEX_CAPITALS } from './hersheyRomanSimplex.ts';
import generatedModuleSource from './hersheyRomanSimplex.ts?raw';

/** Records before `A` in `rowmans.jhf`: the space and the 32 ASCII signs. */
const RECORDS_BEFORE_A = 33;

/**
 * Formats a record the way `.jhf` files do: 5-character glyph number,
 * 3-character vertex count, then the data.
 *
 * @param id - Glyph number.
 * @param data - Bearings and vertex pairs.
 * @returns One record line.
 */
function jhfLine(id: number, data: string): string {
  const vertexCount = data.length / 2;
  return `${String(id).padStart(5)}${String(vertexCount).padStart(3)}${data}`;
}

/**
 * Rebuilds a minimal `rowmans.jhf` from the source records kept in the
 * committed module: 33 placeholder records, then the capitals.
 *
 * @returns Content of a `.jhf` file whose capitals are the original records.
 */
function rebuildJhfFromModule(): string {
  const placeholders = Array.from({ length: RECORDS_BEFORE_A }, () => jhfLine(699, 'JZ'));
  const capitals = Object.values(ROMAN_SIMPLEX_CAPITALS).map((glyph) =>
    jhfLine(glyph.hersheyId, glyph.hersheyRecord),
  );
  return [...placeholders, ...capitals, ''].join('\n');
}

describe('parseJhfRecords', () => {
  it('reads the glyph number and the data of each record', () => {
    expect(parseJhfRecords('  501  9I[RFJ[ RRFZ[ RMTWT\n  509  3NVRFR[\n')).toEqual([
      { id: 501, data: 'I[RFJ[ RRFZ[ RMTWT' },
      { id: 509, data: 'NVRFR[' },
    ]);
  });

  it('joins a record continued on the next line and accepts CRLF endings', () => {
    expect(parseJhfRecords('  501  9I[RFJ[ RRF\r\nZ[ RMTWT\r\n  509  3NVRFR[\r\n')).toEqual([
      { id: 501, data: 'I[RFJ[ RRFZ[ RMTWT' },
      { id: 509, data: 'NVRFR[' },
    ]);
  });

  it('refuses a non-numeric header', () => {
    expect(() => parseJhfRecords('  5x1  9I[RFJ[ RRFZ[ RMTWT')).toThrow(/header on line 1/);
  });

  it('refuses a record shorter than its vertex count announces', () => {
    expect(() => parseJhfRecords('  501 10I[RFJ[ RRFZ[ RMTWT')).toThrow(/announces 10 vertices/);
  });

  it('refuses a record longer than its vertex count announces', () => {
    expect(() => parseJhfRecords('  501  8I[RFJ[ RRFZ[ RMTWT')).toThrow(/announces 8 vertices/);
  });

  it('refuses a record without bearings', () => {
    expect(() => parseJhfRecords('  501  0')).toThrow(/no vertex/);
  });
});

describe('decodeHersheyRecord', () => {
  it('splits strokes on pen-up pairs and reads coordinates relative to R', () => {
    expect(decodeHersheyRecord({ id: 520, data: 'JZRFR[ RKFYF' })).toEqual({
      left: -8,
      right: 8,
      strokes: [
        [
          { x: 0, y: -12 },
          { x: 0, y: 9 },
        ],
        [
          { x: -7, y: -12 },
          { x: 7, y: -12 },
        ],
      ],
    });
  });

  it('refuses a non-printable coordinate character', () => {
    expect(() => decodeHersheyRecord({ id: 1, data: 'JZR\u0007R[' })).toThrow(/non-printable/);
  });

  it('refuses a stroke of a single point', () => {
    expect(() => decodeHersheyRecord({ id: 1, data: 'JZRF RR[S[' })).toThrow(/single point/);
  });
});

describe('convertRomanSimplexCapitals', () => {
  it('refuses a file whose records at the capitals are not glyphs 501 to 526', () => {
    const wrongFont = rebuildJhfFromModule().replace('  501  9', '  601  9');

    expect(() => convertRomanSimplexCapitals(wrongFont)).toThrow(
      /Expected Roman Simplex glyph 501/,
    );
  });

  it('refuses a file that stops before Z', () => {
    const truncated = rebuildJhfFromModule()
      .split('\n')
      .slice(0, RECORDS_BEFORE_A + 25)
      .join('\n');

    expect(() => convertRomanSimplexCapitals(truncated)).toThrow(/526 for "Z".*found nothing/);
  });
});

describe('generateRomanSimplexModule', () => {
  it('regenerates the committed module byte for byte from its source records', () => {
    expect(generateRomanSimplexModule(rebuildJhfFromModule())).toBe(generatedModuleSource);
  });

  it('gives the same output when run twice on the same file', () => {
    const jhf = rebuildJhfFromModule();

    expect(generateRomanSimplexModule(jhf)).toBe(generateRomanSimplexModule(jhf));
  });

  it('marks the module as generated and carries the Hershey acknowledgements', () => {
    expect(generatedModuleSource).toContain('Generated file, do not edit by hand');
    expect(generatedModuleSource).toContain('Dr. A. V. Hershey');
    expect(generatedModuleSource).toContain('U. S. National Bureau of Standards');
    expect(generatedModuleSource).toContain('James Hurt, Cognition, Inc.');
  });
});
