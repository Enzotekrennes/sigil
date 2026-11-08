/**
 * Tests of the source check of `generate-hershey-glyphs.js` (review point
 * S10): a font file whose SHA-256 differs from `ROWMANS_SHA256` is refused
 * with a clear message, before anything is converted or written.
 *
 * Run with `npm run test:scripts` (Node's built-in test runner). The real
 * `rowmans.jhf` is not versioned, so the accepted case uses a digest computed
 * here; the refused cases need no font file at all.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ROWMANS_SHA256, assertRowmansDigest } from './generate-hershey-glyphs.js';

const scriptPath = fileURLToPath(new URL('./generate-hershey-glyphs.js', import.meta.url));
const glyphModulePath = resolve(
  dirname(scriptPath),
  '../src/features/spare/glyphs/hersheyRomanSimplex.ts',
);

/** Content of a font file that is not the expected one: one Hershey record. */
const TAMPERED = '  501  9I[RFJ[ RRFZ[ RMTWT\n';

test('ROWMANS_SHA256 is a lowercase SHA-256 in hexadecimal', () => {
  assert.match(ROWMANS_SHA256, /^[0-9a-f]{64}$/);
});

test('accepts bytes whose digest is the expected one', () => {
  const bytes = Buffer.from(TAMPERED, 'utf8');
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert.doesNotThrow(() => {
    assertRowmansDigest(bytes, 'rowmans.jhf', digest);
  });
});

test('refuses a different file, naming it, both digests and what to do', () => {
  const bytes = Buffer.from(TAMPERED, 'utf8');
  const actual = createHash('sha256').update(bytes).digest('hex');
  assert.throws(
    () => {
      assertRowmansDigest(bytes, 'downloads/rowmans.jhf');
    },
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /^Unexpected SHA-256 for downloads\/rowmans\.jhf:/);
      assert.ok(error.message.includes(`expected ${ROWMANS_SHA256}`));
      assert.ok(error.message.includes(`got      ${actual}`));
      assert.match(error.message, /update ROWMANS_SHA256\. Nothing was written\.$/);
      return true;
    },
  );
});

test('a single changed byte is enough to refuse the file', () => {
  const bytes = Buffer.from(TAMPERED, 'utf8');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const altered = Buffer.from(bytes);
  altered[altered.length - 2] = 0x55;
  assert.throws(() => {
    assertRowmansDigest(altered, 'rowmans.jhf', digest);
  }, /Unexpected SHA-256/);
});

test('the command line stops with code 1 and leaves the glyph module untouched', () => {
  const before = readFileSync(glyphModulePath);
  const folder = mkdtempSync(join(tmpdir(), 'sigil-hershey-'));
  const fontPath = join(folder, 'rowmans.jhf');
  writeFileSync(fontPath, TAMPERED, 'utf8');
  try {
    const run = spawnSync(process.execPath, ['--experimental-strip-types', scriptPath, fontPath], {
      encoding: 'utf8',
    });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Unexpected SHA-256 for .*rowmans\.jhf:/);
    assert.doesNotMatch(run.stdout, /Wrote/);
  } finally {
    const after = readFileSync(glyphModulePath);
    // Puts the committed module back if a broken check let the script overwrite it.
    if (!after.equals(before)) writeFileSync(glyphModulePath, before);
    rmSync(folder, { recursive: true, force: true });
    assert.ok(after.equals(before), 'the glyph module was overwritten');
  }
});
