/**
 * Regenerates `src/features/spare/glyphs/hersheyRomanSimplex.ts` from the
 * Hershey Roman Simplex font file `rowmans.jhf` (plan decision D7).
 *
 * Usage, from the project root:
 *   npm run glyphs:generate -- <path to rowmans.jhf>
 * (equivalent to: node --experimental-strip-types scripts/generate-hershey-glyphs.js <path>)
 *
 * The font file is not versioned: download it from
 * https://raw.githubusercontent.com/kamalmostafa/hershey-fonts/master/hershey-fonts/rowmans.jhf
 * into a folder outside the repository. Before any conversion, the script
 * checks that the file is byte for byte the one the glyphs were generated
 * from (`ROWMANS_SHA256`) and stops without writing anything otherwise. Its
 * content is only parsed, never executed. The conversion itself lives in
 * `hersheyConversion.ts` so that the unit tests exercise the same code; this
 * script only checks, reads and writes files. Writes one file and prints its
 * path; running it twice gives identical bytes.
 *
 * Exposes `ROWMANS_SHA256` and `assertRowmansDigest` for its tests
 * (`generate-hershey-glyphs.test.js`); importing it runs nothing.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { generateRomanSimplexModule } from '../src/features/spare/glyphs/hersheyConversion.ts';

/**
 * SHA-256 of the `rowmans.jhf` the committed glyph module was generated from:
 * the file published at the URL above (repository kamalmostafa/hershey-fonts,
 * 2026-11-08), whose records 501-526 are those of the 1986 Usenet distribution.
 * Converting it again reproduces `hersheyRomanSimplex.ts` byte for byte. A
 * different digest means a changed or corrupted source: compare its records
 * 501-526 with the committed module before updating this value.
 */
export const ROWMANS_SHA256 = '8718fb129c0f6bce89c84fe41bc467e39534d215a6f7c3220cc5789a8a7d8618';

/**
 * Checks that the font file is the expected one before it is converted.
 *
 * @param bytes - Raw content of the file, as read from disk (no newline conversion).
 * @param sourcePath - Path of the file, quoted in the error message.
 * @param expected - Expected SHA-256 in lowercase hexadecimal; `ROWMANS_SHA256` by default.
 * @throws {Error} When the digest of `bytes` differs from `expected`; the
 *   message gives both digests and what to check.
 */
export function assertRowmansDigest(bytes, sourcePath, expected = ROWMANS_SHA256) {
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual === expected) return;
  throw new Error(
    `Unexpected SHA-256 for ${sourcePath}:\n` +
      `  expected ${expected}\n` +
      `  got      ${actual}\n` +
      'The file is not the rowmans.jhf the glyphs were generated from. Download it again ' +
      'from the URL in scripts/generate-hershey-glyphs.js, or, if the source changed on ' +
      'purpose, check its records 501-526 and update ROWMANS_SHA256. Nothing was written.',
  );
}

/**
 * Command-line entry point: checks the font file given as first argument,
 * converts it and overwrites the glyph module.
 *
 * @remarks Writes `src/features/spare/glyphs/hersheyRomanSimplex.ts`; exits
 *   with code 1, without writing, when the argument is missing or the file
 *   fails the digest check.
 */
function main() {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outputPath = resolve(projectRoot, 'src/features/spare/glyphs/hersheyRomanSimplex.ts');

  const sourcePath = process.argv[2];
  if (!sourcePath) {
    console.error(
      'Missing argument: path to rowmans.jhf.\n' +
        'Usage: node --experimental-strip-types scripts/generate-hershey-glyphs.js <path to rowmans.jhf>',
    );
    process.exit(1);
  }

  const bytes = readFileSync(resolve(sourcePath));
  try {
    assertRowmansDigest(bytes, sourcePath);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  writeFileSync(outputPath, generateRomanSimplexModule(bytes.toString('utf8')), 'utf8');
  console.log(`Wrote ${outputPath}`);
}

// Run only from the command line, not when the tests import this file.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
