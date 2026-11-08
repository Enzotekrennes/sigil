/**
 * Regenerates the README showcase images in `.github/readme/`:
 *   - `trace-spare.svg` and `trace-kamea.svg`: a sigil traced in a loop,
 *     "gold on black", with the app's tracing order and timings;
 *   - `examples.svg`: a still sheet of example sigils, "ink on paper",
 *     captioned with the word and the method.
 *
 * Usage, from the project root:
 *   npm run readme:assets
 * (equivalent to: node --experimental-strip-types scripts/generate-readme-assets.js)
 *
 * Why animated SVG rather than the GIF the brief mentions: the tracing is
 * made of vector strokes, so an SVG stays sharp at any size and on high
 * density screens, weighs a few kilobytes where a GIF of the same loop weighs
 * hundreds, keeps the exact theme colours (no 256-colour palette, no dithering
 * on the gold), and is regenerated from the code without a screen recorder.
 * GitHub shows an SVG referenced by `<img>` or Markdown as an image: scripts
 * never run there, but CSS animations do, which is all the tracing needs.
 * Viewers that do not animate SVG, and readers who ask for reduced motion,
 * see the complete sigil, still.
 *
 * The sigils come from the app's own entry points (`traceKamea`,
 * `traceSpare` in `src/app/trace.ts`), so the words go through the same
 * normalisation and single-word rule as on screen, and the drawing reuses the
 * renderer's geometry (see `readme-assets.js`). Those entry points reach the
 * renderer (`.tsx`, `.css`), which Node cannot load: they are loaded through
 * Vite's server-side module loader, already a dev dependency, with no config
 * file and no network listener.
 *
 * Deterministic: the sigils depend only on their word and settings, and no
 * date or random value is written, so running it twice gives the same bytes.
 * Writes three files and prints their paths and sizes; refuses to write any
 * file over `README_ASSET_MAX_BYTES`. Exposes `README_EXAMPLES`,
 * `README_TRACES` and `README_ASSET_MAX_BYTES` for its tests; importing it
 * runs nothing.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GOLD_ON_BLACK, INK_ON_PAPER, animatedTraceSvg, exampleSheetSvg } from './readme-assets.js';

/**
 * Largest file accepted, in bytes: a README image should load at once, even
 * on a slow connection. The current files weigh a few kilobytes each.
 */
export const README_ASSET_MAX_BYTES = 30 * 1024;

/*
 * A showcase sigil is described by its `word` (intention as typed in the app,
 * a single word, decision D18), its `method` (`kamea` or `spare`), and either
 * its `planet` (square of a kamea sigil, a `Planet` of `sigil/types.ts`) or
 * its `variant` (internal Spare variant number, 0 being shown "variant 1").
 */

/**
 * Sigils of the two animated images. "Amour" in Spare, variant 2 on screen
 * (internal 1): the variant that reads as a bind rune close to the "love"
 * rune. "Calme" on the square of the Moon: its five cells (3, 1, 12, 13, 5)
 * spread a path of distinct segments over the whole frame, where on the 3 × 3
 * square of Saturn (3, 1, 3, 4, 5) the path runs back over itself and keeps
 * to the left half.
 */
export const README_TRACES = {
  spare: { word: 'Amour', method: 'spare', variant: 1 },
  kamea: { word: 'Calme', method: 'kamea', planet: 'moon' },
};

/**
 * Sigils of the example sheet, in reading order: French and English single
 * words, four per method, every planet square used at most once.
 */
export const README_EXAMPLES = [
  README_TRACES.spare,
  README_TRACES.kamea,
  { word: 'Force', method: 'spare', variant: 0 },
  { word: 'Courage', method: 'kamea', planet: 'mars' },
  { word: 'Luck', method: 'kamea', planet: 'jupiter' },
  { word: 'Home', method: 'spare', variant: 0 },
  { word: 'Voyage', method: 'kamea', planet: 'mercury' },
  { word: 'Dream', method: 'spare', variant: 0 },
];

/** Vowel setting of the Spare examples: the app's default, vowels dropped (decision D4). */
const SPARE_KEEP_VOWELS = false;

/**
 * Builds one showcase sigil with the app's own entry points.
 *
 * @param entry - Word and settings.
 * @param app - `traceKamea` and `traceSpare` of `src/app/trace.ts`.
 * @returns The sigil.
 * @throws {Error} When the app refuses the word (a typo in the lists above),
 *   naming the word and the error code.
 */
function buildShowcaseSigil(entry, app) {
  const traced =
    entry.method === 'kamea'
      ? app.traceKamea(entry.word, entry.planet)
      : app.traceSpare(entry.word, { keepVowels: SPARE_KEEP_VOWELS, variant: entry.variant });
  if (!traced.ok) {
    throw new Error(
      `Cannot draw the ${entry.method} sigil of "${entry.word}": ${traced.error.code}. ` +
        'Check README_TRACES and README_EXAMPLES in scripts/generate-readme-assets.js.',
    );
  }
  return traced.sigil;
}

/**
 * Second caption line of an example: method and setting, in English like the README.
 *
 * @param entry - Word and settings.
 * @param planetNames - English planet names of the app (`STRINGS_EN.planet.names`).
 * @returns For example `KAMEA · SATURN` or `SPARE · VARIANT 2`.
 */
function methodCaption(entry, planetNames) {
  const setting =
    entry.method === 'kamea' ? planetNames[entry.planet] : `variant ${String(entry.variant + 1)}`;
  return `${entry.method} · ${setting}`.toUpperCase();
}

/**
 * Builds the three images from the app's modules.
 *
 * @param app - `traceKamea` and `traceSpare` of `src/app/trace.ts`.
 * @param planetNames - English planet names of the app.
 * @returns File names mapped to their SVG text.
 * @throws {Error} When a word is refused by the app.
 */
function buildReadmeAssets(app, planetNames) {
  const examples = README_EXAMPLES.map((entry) => ({
    sigil: buildShowcaseSigil(entry, app),
    word: entry.word,
    method: methodCaption(entry, planetNames),
  }));
  return {
    'trace-spare.svg': animatedTraceSvg(
      buildShowcaseSigil(README_TRACES.spare, app),
      GOLD_ON_BLACK,
      `Spare sigil of “${README_TRACES.spare.word}” being traced`,
    ),
    'trace-kamea.svg': animatedTraceSvg(
      buildShowcaseSigil(README_TRACES.kamea, app),
      GOLD_ON_BLACK,
      `Kamea sigil of “${README_TRACES.kamea.word}” being traced`,
    ),
    'examples.svg': exampleSheetSvg(examples, INK_ON_PAPER, 'Example sigils'),
  };
}

/**
 * Loads the app's trace entry points and English strings through Vite's
 * server-side module loader, then closes it.
 *
 * @param projectRoot - Absolute path of the project root.
 * @returns `traceKamea`, `traceSpare` and the English planet names.
 * @remarks Starts a Vite server in middleware mode (no port opened, no file
 *   watched for long, no config file read) for the time of the import.
 */
async function loadApp(projectRoot) {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: false,
    root: projectRoot,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const trace = await server.ssrLoadModule('/src/app/trace.ts');
    const strings = await server.ssrLoadModule('/src/app/strings.en.ts');
    return {
      app: { traceKamea: trace.traceKamea, traceSpare: trace.traceSpare },
      planetNames: strings.STRINGS_EN.planet.names,
    };
  } finally {
    await server.close();
  }
}

/**
 * Command-line entry point: builds the images and writes them.
 *
 * @remarks Creates `.github/readme/` if needed and overwrites its three
 *   files; exits with code 1, writing nothing, when a word is refused or a
 *   file would exceed `README_ASSET_MAX_BYTES`.
 */
async function main() {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const outputDirectory = resolve(projectRoot, '.github/readme');

  let files;
  try {
    const { app, planetNames } = await loadApp(projectRoot);
    files = buildReadmeAssets(app, planetNames);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const oversized = Object.entries(files).filter(
    ([, svg]) => Buffer.byteLength(svg, 'utf8') > README_ASSET_MAX_BYTES,
  );
  if (oversized.length > 0) {
    for (const [name, svg] of oversized) {
      console.error(
        `${name} would weigh ${String(Buffer.byteLength(svg, 'utf8'))} bytes, over the ` +
          `${String(README_ASSET_MAX_BYTES)} allowed. Choose shorter words or fewer examples. ` +
          'Nothing was written.',
      );
    }
    process.exit(1);
  }

  mkdirSync(outputDirectory, { recursive: true });
  for (const [name, svg] of Object.entries(files)) {
    const path = resolve(outputDirectory, name);
    writeFileSync(path, svg, 'utf8');
    console.log(`Wrote ${path} (${String(Buffer.byteLength(svg, 'utf8'))} bytes)`);
  }
}

// Run only from the command line, not when the tests import this file.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
