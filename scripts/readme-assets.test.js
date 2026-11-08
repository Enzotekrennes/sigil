/**
 * Tests of the README showcase images (`readme-assets.js`) and of the list of
 * sigils `generate-readme-assets.js` draws: timings equal to the app's,
 * motion confined to a `prefers-reduced-motion: no-preference` block so the
 * still file is the complete sigil, colours and motion values equal to
 * `src/styles/tokens.css`, no external reference, deterministic output.
 *
 * Run with `npm run test:scripts` (Node's built-in test runner). The sigils
 * here are small hand-made ones, so the tests need neither Vite nor the
 * methods; the real sigils are checked by running `npm run readme:assets`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PEN_LIFT_MS, TRACE_DURATION_MS, TRACE_MAX_MS } from '../src/features/sigil/geometry.ts';
import {
  README_ASSET_MAX_BYTES,
  README_EXAMPLES,
  README_TRACES,
} from './generate-readme-assets.js';
import {
  EASE_STANDARD,
  EASE_TRACE,
  FADE_MS,
  FADE_OUT_MS,
  GOLD_ON_BLACK,
  HOLD_MS,
  INK_ON_PAPER,
  animatedTraceSvg,
  exampleSheetSvg,
  traceTimeline,
} from './readme-assets.js';

const tokensCss = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

/**
 * Value of a custom property in one block of tokens.css.
 *
 * @param selector - Opening line of the block, such as `:root {`.
 * @param name - Custom property, `--` included.
 * @returns Its raw value, `var()` references followed within the same block
 *   then within `:root`.
 */
function token(selector, name) {
  const start = tokensCss.indexOf(selector);
  assert.notEqual(start, -1, `block ${selector} not found in tokens.css`);
  const block = tokensCss.slice(start, tokensCss.indexOf('\n}', start));
  const match = new RegExp(`\\s${name}:\\s*([^;]+);`).exec(block);
  if (match === null) {
    assert.notEqual(selector, ':root {', `${name} not found in tokens.css`);
    return token(':root {', name);
  }
  const value = match[1].trim();
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference === null ? value : token(selector, reference[1]);
}

const LIGHT = ':root {';
const DARK = ':root[data-theme="dark"] {';

/**
 * A straight polyline along y = 50 from x = 10.
 *
 * @param length - Length in frame units.
 * @returns Its two points.
 */
function line(length) {
  return [
    { x: 10, y: 50 },
    { x: 10 + length, y: 50 },
  ];
}

/** A kamea-like sigil: one path, a start circle and an end bar. */
const KAMEA_LIKE = {
  strokes: [line(60)],
  marks: [
    { kind: 'start-circle', center: { x: 10, y: 50 }, radius: 3 },
    { kind: 'end-bar', center: { x: 70, y: 50 }, angle: 90, length: 9.6 },
  ],
  viewBox: { x: 0, y: 0, width: 100, height: 100 },
};

/** A Spare-like sigil: three strokes, no mark. */
const SPARE_LIKE = {
  strokes: [line(40), line(20), line(20)],
  marks: [],
  viewBox: { x: 0, y: 0, width: 100, height: 100 },
};

/**
 * Splits an animated SVG into what applies everywhere and what applies only
 * when motion is allowed.
 *
 * @param svg - Output of `animatedTraceSvg`.
 * @returns `motion`, the content of the media block, and `still`, the file
 *   without it.
 */
function splitMotion(svg) {
  const open = '@media (prefers-reduced-motion:no-preference){';
  const start = svg.indexOf(open);
  assert.notEqual(start, -1, 'no motion block');
  const end = svg.indexOf('\n}\n</style>', start);
  return {
    motion: svg.slice(start + open.length, end),
    still: svg.slice(0, start) + svg.slice(end + 2),
  };
}

/**
 * Percentages of a keyframes rule, in source order.
 *
 * @param css - Style sheet text.
 * @param name - Name of the keyframes rule.
 * @returns Every percentage of its selectors, as numbers.
 */
function keyframePercents(css, name) {
  const match = new RegExp(`@keyframes ${name}\\{(.*?)\\}\\}`).exec(css);
  assert.notEqual(match, null, `@keyframes ${name} not found`);
  return [...match[1].matchAll(/([\d.]+)%/g)].map((found) => Number(found[1]));
}

test('motion values and palettes are those of tokens.css', () => {
  assert.equal(`${String(FADE_MS)}ms`, token(LIGHT, '--duration-fade'));
  assert.equal(EASE_TRACE, token(LIGHT, '--ease-trace'));
  assert.equal(EASE_STANDARD, token(LIGHT, '--ease-standard'));
  assert.deepEqual(GOLD_ON_BLACK, {
    background: token(DARK, '--color-surface'),
    ink: token(DARK, '--sigil-stroke'),
    text: token(DARK, '--color-text'),
    muted: token(DARK, '--color-text-muted'),
  });
  assert.deepEqual(INK_ON_PAPER, {
    background: token(LIGHT, '--color-surface'),
    ink: token(LIGHT, '--sigil-stroke'),
    text: token(LIGHT, '--color-text'),
    muted: token(LIGHT, '--color-text-muted'),
  });
});

test('a single path is traced in the full tracing time with the kamea easing', () => {
  const timeline = traceTimeline(KAMEA_LIKE.strokes);
  assert.deepEqual(timeline.strokes, [{ start: FADE_MS, end: FADE_MS + TRACE_DURATION_MS }]);
  assert.equal(timeline.traceEnd, FADE_MS + TRACE_DURATION_MS);
  assert.equal(timeline.complete, timeline.traceEnd + FADE_MS);
  assert.equal(timeline.cycle, Math.ceil(timeline.complete + HOLD_MS + FADE_OUT_MS));
  assert.equal(timeline.easing, EASE_TRACE);
});

test('several strokes share the time by length, linear, with a pen lift between two', () => {
  const timeline = traceTimeline(SPARE_LIKE.strokes);
  assert.equal(timeline.easing, 'linear');
  const [first, second, third] = timeline.strokes;
  assert.equal(first.start, FADE_MS);
  assert.equal(first.end - first.start, TRACE_DURATION_MS / 2);
  assert.equal(second.start - first.end, PEN_LIFT_MS);
  assert.equal(second.end - second.start, TRACE_DURATION_MS / 4);
  assert.equal(third.start - second.end, PEN_LIFT_MS);
  assert.equal(timeline.traceEnd, third.end);
  assert.equal(timeline.traceEnd, FADE_MS + TRACE_DURATION_MS + 2 * PEN_LIFT_MS);
});

test('many strokes are sped up to keep the tracing within the app cap', () => {
  const strokes = Array.from({ length: 12 }, () => line(5));
  const timeline = traceTimeline(strokes);
  assert.ok(Math.abs(timeline.traceEnd - FADE_MS - TRACE_MAX_MS) < 1e-9);
  const last = timeline.strokes.at(-1);
  assert.ok(Math.abs(last.end - timeline.traceEnd) < 1e-9);
});

test('a sigil without strokes cannot be animated', () => {
  assert.throws(() => traceTimeline([]), RangeError);
});

test('the still file is the complete sigil: all motion sits in the no-preference block', () => {
  for (const sigil of [KAMEA_LIKE, SPARE_LIKE]) {
    const svg = animatedTraceSvg(sigil, GOLD_ON_BLACK, 'Trace');
    const { motion, still } = splitMotion(svg);
    for (const css of ['animation', 'dash', 'visibility', 'opacity', '@keyframes']) {
      assert.ok(!still.includes(css), `"${css}" outside the motion block`);
    }
    assert.ok(motion.includes('infinite'));
    assert.equal((svg.match(/<path /g) ?? []).length, sigil.strokes.length);
    assert.equal((svg.match(/pathLength="1"/g) ?? []).length, sigil.strokes.length);
  }
});

test('strokes are revealed in order and stay drawn until the loop ends', () => {
  const svg = animatedTraceSvg(SPARE_LIKE, GOLD_ON_BLACK, 'Trace');
  const { motion } = splitMotion(svg);
  let previousEnd = 0;
  SPARE_LIKE.strokes.forEach((_, index) => {
    const [zero, start, end, hundred] = keyframePercents(motion, `stroke-${String(index)}`);
    assert.equal(zero, 0);
    assert.equal(hundred, 100);
    assert.ok(start > previousEnd, `stroke ${String(index)} starts before the previous one ends`);
    assert.ok(end > start);
    previousEnd = end;
  });
  // The fade-out starts only once the sigil has been complete for HOLD_MS.
  const timeline = traceTimeline(SPARE_LIKE.strokes);
  const [, fadeOutStart] = keyframePercents(motion, 'ink-cycle');
  assert.ok(Math.abs(fadeOutStart - ((timeline.complete + HOLD_MS) / timeline.cycle) * 100) < 1e-3);
  assert.ok(fadeOutStart > previousEnd);
  assert.ok(motion.includes(`animation:stroke-0 ${String(timeline.cycle)}ms infinite`));
});

test('marks fade in before and after the path; a sigil without marks has no mark rule', () => {
  const kamea = splitMotion(animatedTraceSvg(KAMEA_LIKE, GOLD_ON_BLACK, 'Trace')).motion;
  const [, startShown] = keyframePercents(kamea, 'mark-start');
  const [, , pathEnd] = keyframePercents(kamea, 'stroke-0');
  const [, endHidden, endShown] = keyframePercents(kamea, 'mark-end');
  const [, pathStart] = keyframePercents(kamea, 'stroke-0');
  assert.equal(startShown, pathStart);
  assert.equal(endHidden, pathEnd);
  assert.ok(endShown > endHidden);
  assert.ok(kamea.includes(`animation-timing-function:${EASE_TRACE}`));

  const spare = splitMotion(animatedTraceSvg(SPARE_LIKE, GOLD_ON_BLACK, 'Trace')).motion;
  assert.ok(!spare.includes('mark-'));
  assert.ok(!spare.includes(EASE_TRACE));
});

test('the images are standalone, escaped and deterministic', () => {
  const trace = animatedTraceSvg(KAMEA_LIKE, GOLD_ON_BLACK, 'A "<b>" & c');
  const sheet = exampleSheetSvg(
    [{ sigil: SPARE_LIKE, word: 'L’<amour>', method: 'SPARE · VARIANT 1' }],
    INK_ON_PAPER,
    'Sheet',
  );
  for (const svg of [trace, sheet]) {
    assert.ok(
      svg.startsWith(
        '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"',
      ),
    );
    assert.ok(svg.endsWith('</svg>\n'));
    // The only URL is the SVG namespace: no link, image, font, script or import.
    assert.deepEqual(svg.match(/https?:/g), ['http:']);
    for (const forbidden of ['href', 'url(', '@import', '<script', '@font-face', 'var(']) {
      assert.ok(!svg.includes(forbidden), `"${forbidden}" in a showcase image`);
    }
  }
  assert.ok(trace.includes('<title>A &quot;&lt;b&gt;&quot; &amp; c</title>'));
  assert.ok(sheet.includes('>L’&lt;amour&gt;</text>'));
  assert.equal(
    animatedTraceSvg(KAMEA_LIKE, GOLD_ON_BLACK, 'T'),
    animatedTraceSvg(KAMEA_LIKE, GOLD_ON_BLACK, 'T'),
  );
});

test('the example sheet lays sigils out four per row, each with its two captions', () => {
  const examples = Array.from({ length: 6 }, (_, index) => ({
    sigil: index % 2 === 0 ? KAMEA_LIKE : SPARE_LIKE,
    word: `Word${String(index)}`,
    method: 'KAMEA · MOON',
  }));
  const svg = exampleSheetSvg(examples, INK_ON_PAPER, 'Sheet');
  assert.equal((svg.match(/class="word"/g) ?? []).length, 6);
  assert.equal((svg.match(/class="method"/g) ?? []).length, 6);
  assert.equal((svg.match(/<g transform=/g) ?? []).length, 6);
  // Four columns of 108 units plus padding, two rows of 132 units plus padding.
  assert.ok(svg.includes('viewBox="0 0 440 272"'));
  assert.ok(svg.includes('font-family:serif;'));
  assert.ok(!svg.includes('animation'));
  assert.throws(() => exampleSheetSvg([], INK_ON_PAPER, 'Sheet'), RangeError);
});

test('the README sigils are single words, both methods, six to eight on the sheet', () => {
  assert.ok(README_EXAMPLES.length >= 6 && README_EXAMPLES.length <= 8);
  assert.ok(README_EXAMPLES.includes(README_TRACES.spare));
  assert.ok(README_EXAMPLES.includes(README_TRACES.kamea));
  const methods = README_EXAMPLES.map((entry) => entry.method);
  assert.equal(methods.filter((method) => method === 'kamea').length, 4);
  assert.equal(methods.filter((method) => method === 'spare').length, 4);
  for (const entry of README_EXAMPLES) {
    assert.match(entry.word, /^\p{L}+$/u);
    if (entry.method === 'kamea') assert.equal(typeof entry.planet, 'string');
    else assert.ok(Number.isInteger(entry.variant) && entry.variant >= 0);
  }
  assert.deepEqual(README_TRACES.spare, { word: 'Amour', method: 'spare', variant: 1 });
  assert.equal(README_ASSET_MAX_BYTES, 30 * 1024);
});
