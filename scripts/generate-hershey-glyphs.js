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
 * into a folder outside the repository. Its content is only parsed, never
 * executed. The conversion itself lives in `hersheyConversion.ts` so that the
 * unit tests exercise the same code; this script only reads and writes files.
 * Writes one file and prints its path; running it twice gives identical bytes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateRomanSimplexModule } from '../src/features/spare/glyphs/hersheyConversion.ts';

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

const source = readFileSync(resolve(sourcePath), 'utf8');
writeFileSync(outputPath, generateRomanSimplexModule(source), 'utf8');
console.log(`Wrote ${outputPath}`);
