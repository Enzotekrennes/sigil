/**
 * Conversion of the Hershey Roman Simplex font file (`rowmans.jhf`, James
 * Hurt's format) into the generated TypeScript module of letter skeletons
 * (plan decision D7).
 *
 * Exposes the parsing and decoding steps and `generateRomanSimplexModule`,
 * which `scripts/generate-hershey-glyphs.js` calls to write
 * `hersheyRomanSimplex.ts`. Build-time tooling only: the application imports
 * the generated module, never this file. The font file is treated as
 * untrusted input: it is parsed character by character and any deviation from
 * the format throws, nothing in it is evaluated.
 *
 * Kept free of non-erasable TypeScript syntax so that Node runs it directly
 * with type stripping.
 */
import type { Box, Point } from '../../sigil/types.ts';
import type { CapitalLetter, HersheyGlyphRecord } from './types.ts';

/** One glyph record of a `.jhf` file, before decoding. */
export interface JhfRecord {
  /** Hershey glyph number (columns 1–5 of the record). */
  readonly id: number;
  /** Left/right bearings then vertex pairs, two characters per pair. */
  readonly data: string;
}

/** A record decoded into raw Hershey coordinates (origin on the centre line, y down). */
export interface DecodedHersheyGlyph {
  readonly left: number;
  readonly right: number;
  /** Pen strokes in drawing order, each of at least two points. */
  readonly strokes: readonly (readonly Point[])[];
}

/** Width of the glyph number field at the start of a record. */
const ID_FIELD_WIDTH = 5;

/** Width of the vertex count field that follows the glyph number. */
const COUNT_FIELD_WIDTH = 3;

/** Characters per vertex: one for x, one for y. */
const CHARACTERS_PER_PAIR = 2;

/** Coordinates are stored as characters offset from `R` (code 82), so `R` means 0. */
const COORDINATE_ORIGIN = 'R'.charCodeAt(0);

/** Pair that lifts the pen between two strokes ("pen up" in Hurt's format). */
const PEN_UP = ' R';

/** Lowest and highest character codes a coordinate may use (printable ASCII). */
const MIN_COORDINATE_CODE = 0x20;
const MAX_COORDINATE_CODE = 0x7e;

/**
 * `rowmans.jhf` lists the printable ASCII characters in order from the space
 * (code 32), one record each, so `A` is the record at index 65 − 32.
 */
const FIRST_CAPITAL_RECORD_INDEX = 'A'.charCodeAt(0) - ' '.charCodeAt(0);

/**
 * Hershey number of Roman Simplex `A`; the capitals follow in order up to
 * `Z` = 526. Checked on every record so that a different font file is refused.
 */
const ROMAN_SIMPLEX_A_ID = 501;

/**
 * Raw y of the baseline of Roman Simplex capitals (character `[`): every
 * capital rests on it and its cap line is at −12, so caps are 21 units tall.
 */
const ROMAN_SIMPLEX_BASELINE = 9;

/** The 26 capitals in alphabetical order. */
const CAPITAL_LETTERS: readonly CapitalLetter[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
];

/** Command that regenerates the module, quoted in its header. */
const REGENERATE_COMMAND = 'npm run glyphs:generate -- <path to rowmans.jhf>';

/** Where the source file was obtained, quoted in the generated header. */
const SOURCE_URL =
  'https://github.com/kamalmostafa/hershey-fonts/blob/master/hershey-fonts/rowmans.jhf';

/**
 * Acknowledgements required by the Hershey Fonts distribution notice, written
 * as a legal comment: `/*!` and `@license` tell the minifier to keep it in the
 * built bundle (with `output.comments.legal` enabled in `vite.config.ts`), so
 * the acknowledgements travel with the font data wherever the site is served.
 */
const LEGAL_COMMENT: readonly string[] = [
  '/*!',
  ' * @license Hershey Fonts, Roman Simplex capitals A–Z.',
  ' * The Hershey Fonts were originally created by Dr. A. V. Hershey while',
  ' * working at the U. S. National Bureau of Standards.',
  ' * The format of the Font data in this distribution was originally created by',
  ' * James Hurt, Cognition, Inc., 900 Technology Park Drive, Billerica, MA 01821',
  ' * (mit-eddie!ci-dandelion!hurt).',
  ' * Converted from that format into numeric coordinates; see NOTICE.',
  ' */',
];

/**
 * Splits the content of a `.jhf` file into its glyph records.
 *
 * A record starts with a 5-character glyph number and a 3-character vertex
 * count (the bearings count as one vertex), followed by two characters per
 * vertex. Long records continue on the next lines, which are joined until the
 * announced length is reached.
 *
 * @param text - Content of a `.jhf` file; LF or CRLF line endings.
 * @returns The records in file order.
 * @throws {Error} When a header is not numeric, a vertex count is zero, or the data
 *   does not have exactly the announced length.
 */
export function parseJhfRecords(text: string): JhfRecord[] {
  const lines = text.split(/\r?\n/);
  const records: JhfRecord[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex] ?? '';
    lineIndex += 1;
    if (line.trim() === '') continue;

    const idField = line.slice(0, ID_FIELD_WIDTH).trim();
    const countField = line.slice(ID_FIELD_WIDTH, ID_FIELD_WIDTH + COUNT_FIELD_WIDTH).trim();
    if (!/^\d+$/.test(idField) || !/^\d+$/.test(countField)) {
      throw new Error(
        `Invalid .jhf record header on line ${String(lineIndex)}: expected a glyph number and a vertex count, got "${line.slice(0, ID_FIELD_WIDTH + COUNT_FIELD_WIDTH)}".`,
      );
    }

    const id = Number(idField);
    const vertexCount = Number(countField);
    if (vertexCount === 0) {
      throw new Error(`Glyph ${idField} announces no vertex: its bearings are missing.`);
    }

    const expectedLength = vertexCount * CHARACTERS_PER_PAIR;
    let data = line.slice(ID_FIELD_WIDTH + COUNT_FIELD_WIDTH);
    while (data.length < expectedLength && lineIndex < lines.length) {
      data += lines[lineIndex] ?? '';
      lineIndex += 1;
    }
    if (data.length !== expectedLength) {
      throw new Error(
        `Glyph ${idField} announces ${String(vertexCount)} vertices (${String(expectedLength)} characters) but has ${String(data.length)} characters of data.`,
      );
    }

    records.push({ id, data });
  }

  return records;
}

/**
 * Reads one coordinate character.
 *
 * @param character - A printable ASCII character of a vertex pair.
 * @param id - Glyph number, for the error message.
 * @returns The coordinate in raw Hershey units (`R` = 0).
 * @throws {Error} When the character is outside printable ASCII.
 */
function decodeCoordinate(character: string, id: number): number {
  const code = character.charCodeAt(0);
  if (code < MIN_COORDINATE_CODE || code > MAX_COORDINATE_CODE) {
    throw new Error(
      `Glyph ${String(id)} contains a non-printable coordinate character (code ${String(code)}).`,
    );
  }
  return code - COORDINATE_ORIGIN;
}

/**
 * Decodes a record into bearings and pen strokes, in raw Hershey coordinates.
 *
 * @param record - A record returned by `parseJhfRecords`.
 * @returns The bearings and the strokes in drawing order.
 * @throws {Error} When a coordinate character is not printable ASCII, or when a stroke
 *   has fewer than two points (a dot, which no capital letter contains).
 */
export function decodeHersheyRecord(record: JhfRecord): DecodedHersheyGlyph {
  const { id, data } = record;
  const left = decodeCoordinate(data.charAt(0), id);
  const right = decodeCoordinate(data.charAt(1), id);
  const strokes: Point[][] = [];
  let current: Point[] = [];

  const closeStroke = () => {
    if (current.length === 0) return;
    if (current.length < 2) {
      throw new Error(`Glyph ${String(id)} has a stroke of a single point.`);
    }
    strokes.push(current);
    current = [];
  };

  for (let offset = CHARACTERS_PER_PAIR; offset < data.length; offset += CHARACTERS_PER_PAIR) {
    const pair = data.slice(offset, offset + CHARACTERS_PER_PAIR);
    if (pair === PEN_UP) {
      closeStroke();
      continue;
    }
    current.push({
      x: decodeCoordinate(pair.charAt(0), id),
      y: decodeCoordinate(pair.charAt(1), id),
    });
  }
  closeStroke();

  return { left, right, strokes };
}

/**
 * Computes the tight bounding box of a set of strokes.
 *
 * @param strokes - At least one stroke with at least one point.
 * @returns The smallest box containing every point.
 */
function boundsOf(strokes: readonly (readonly Point[])[]): Box {
  const points = strokes.flat();
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

/**
 * Moves a decoded capital into the glyph frame: x from the left side bearing,
 * y from the baseline, both in Hershey units.
 *
 * @param record - Source record, kept for provenance.
 * @param decoded - The same record decoded.
 * @returns The generated glyph data.
 * @throws {Error} When the glyph has no stroke.
 */
function toGlyphRecord(record: JhfRecord, decoded: DecodedHersheyGlyph): HersheyGlyphRecord {
  if (decoded.strokes.length === 0) {
    throw new Error(`Glyph ${String(record.id)} has no stroke.`);
  }
  const strokes = decoded.strokes.map((stroke) =>
    stroke.map((point) => ({ x: point.x - decoded.left, y: point.y - ROMAN_SIMPLEX_BASELINE })),
  );
  return {
    hersheyId: record.id,
    hersheyRecord: record.data,
    hersheyLeft: decoded.left,
    hersheyRight: decoded.right,
    advance: decoded.right - decoded.left,
    bounds: boundsOf(strokes),
    strokes,
  };
}

/**
 * Extracts and converts the 26 capitals of a Roman Simplex `.jhf` file.
 *
 * @param jhfText - Content of `rowmans.jhf` (records in ASCII order from the space).
 * @returns The capitals A–Z in the glyph frame.
 * @throws {Error} When the file is malformed, too short, or when a record found at a
 *   capital's position is not the expected Roman Simplex glyph (501 … 526).
 */
export function convertRomanSimplexCapitals(
  jhfText: string,
): Record<CapitalLetter, HersheyGlyphRecord> {
  const records = parseJhfRecords(jhfText);
  const entries = CAPITAL_LETTERS.map((letter, index) => {
    const record = records[FIRST_CAPITAL_RECORD_INDEX + index];
    const expectedId = ROMAN_SIMPLEX_A_ID + index;
    if (record?.id !== expectedId) {
      throw new Error(
        `Expected Roman Simplex glyph ${String(expectedId)} for "${letter}" at record ${String(FIRST_CAPITAL_RECORD_INDEX + index + 1)}, found ${record ? String(record.id) : 'nothing'}: is this rowmans.jhf?`,
      );
    }
    return [letter, toGlyphRecord(record, decodeHersheyRecord(record))] as const;
  });
  // Object.fromEntries loses the key type; the 26 entries above cover every CapitalLetter.
  return Object.fromEntries(entries) as Record<CapitalLetter, HersheyGlyphRecord>;
}

/**
 * Writes a string as a single-quoted TypeScript literal.
 *
 * @param value - Any string.
 * @returns The literal, quotes included.
 */
function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Prints one glyph as an object literal of the generated module.
 *
 * @param letter - Key of the glyph.
 * @param glyph - Converted glyph.
 * @returns Lines of source, indented for the top-level object, already in
 *   the layout Prettier produces so that formatting the project leaves the
 *   generated file unchanged.
 */
function printGlyph(letter: CapitalLetter, glyph: HersheyGlyphRecord): string[] {
  const { x, y, width, height } = glyph.bounds;
  const strokeLines = glyph.strokes.flatMap((stroke) => [
    '      [',
    ...stroke.map((point) => `        { x: ${String(point.x)}, y: ${String(point.y)} },`),
    '      ],',
  ]);
  return [
    `  ${letter}: {`,
    `    hersheyId: ${String(glyph.hersheyId)},`,
    `    hersheyRecord: ${quote(glyph.hersheyRecord)},`,
    `    hersheyLeft: ${String(glyph.hersheyLeft)},`,
    `    hersheyRight: ${String(glyph.hersheyRight)},`,
    `    advance: ${String(glyph.advance)},`,
    `    bounds: { x: ${String(x)}, y: ${String(y)}, width: ${String(width)}, height: ${String(height)} },`,
    '    strokes: [',
    ...strokeLines,
    '    ],',
    '  },',
  ];
}

/**
 * Builds the full source of `hersheyRomanSimplex.ts` from `rowmans.jhf`.
 * The output depends only on the 26 capital records, so running the
 * generation twice on the same file gives the same bytes.
 *
 * @param jhfText - Content of `rowmans.jhf`.
 * @returns TypeScript source ending with a newline.
 * @throws {Error} See `convertRomanSimplexCapitals`.
 */
export function generateRomanSimplexModule(jhfText: string): string {
  const glyphs = convertRomanSimplexCapitals(jhfText);
  const header = [
    '/**',
    ' * Hershey Roman Simplex capitals A–Z as single-stroke polylines, the letter',
    ' * skeletons of the Spare method (plan decision D7).',
    ' *',
    ' * Generated file, do not edit by hand. Regenerate with:',
    ` *   ${REGENERATE_COMMAND}`,
    ` * Source: ${SOURCE_URL}`,
    ' * (records 501–526 identical to the 1986 Usenet distribution, mod.sources',
    ' * volume 4, issue 42).',
    ' *',
    ' * Coordinates are in the glyph frame described in `types.ts`: Hershey units,',
    ' * x from the left side bearing, y downwards from the baseline.',
    ' *',
    ' * The acknowledgements below are a legal comment (opened with "/*" and "!"): the',
    ' * production build keeps it next to the glyph data, as the distribution notice requires.',
    ' */',
    "import type { CapitalLetter, HersheyGlyphRecord } from './types.ts';",
    '',
    ...LEGAL_COMMENT,
    '',
    '/** Roman Simplex capitals by letter, with their Hershey provenance. */',
    'export const ROMAN_SIMPLEX_CAPITALS: Readonly<Record<CapitalLetter, HersheyGlyphRecord>> = {',
  ];
  const body = CAPITAL_LETTERS.flatMap((letter) => printGlyph(letter, glyphs[letter]));
  return [...header, ...body, '};', ''].join('\n');
}
