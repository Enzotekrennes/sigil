/**
 * Writes the SVG markup of the README showcase images: the animated tracing
 * of one sigil ("gold on black") and a sheet of example sigils ("ink on
 * paper"), both standalone files with literal colours and no external
 * reference (no font, image, link or script).
 *
 * Exposes `animatedTraceSvg`, `exampleSheetSvg`, `traceTimeline`, the
 * palettes `GOLD_ON_BLACK` and `INK_ON_PAPER`, and the motion constants that
 * mirror `src/styles/tokens.css` (`FADE_MS`, `EASE_TRACE`, `EASE_STANDARD`,
 * checked equal by `readme-assets.test.js`). Pure: takes sigils already built
 * by the app's methods and draws them with the app's own geometry
 * (`fittedDrawing`, `traceSchedule`, `traceTimeScale`, `polylinePathData`,
 * `endBarEndpoints`), so a showcase image matches the screen. Builds no
 * sigil, reads and writes no file: see `generate-readme-assets.js`.
 *
 * Imports only modules Node can load with `--experimental-strip-types`
 * (plain `.ts` files without JSX or CSS), so its tests run without Vite.
 */
import { fittedDrawing } from '../src/features/sigil/frameFit.ts';
import {
  PEN_LIFT_MS,
  TRACE_DURATION_MS,
  endBarEndpoints,
  formatCoordinate,
  polylinePathData,
  traceSchedule,
  traceTimeScale,
} from '../src/features/sigil/geometry.ts';
import { DEFAULT_STYLE_OPTIONS, frameCenter, lineEndsFor } from '../src/features/sigil/style.ts';

/** Fade of the marks, in ms: `--duration-fade` of tokens.css. */
export const FADE_MS = 150;

/** Easing of the single kamea path: `--ease-trace` of tokens.css. */
export const EASE_TRACE = 'cubic-bezier(0.45, 0, 0.25, 1)';

/** Easing of the fades: `--ease-standard` of tokens.css. */
export const EASE_STANDARD = 'cubic-bezier(0.2, 0, 0, 1)';

/**
 * Time the complete sigil stays on screen before the loop starts again, in
 * ms: long enough to look at the finished seal, about as long as its tracing.
 */
export const HOLD_MS = 2500;

/** Fade-out of the complete sigil at the end of each loop, in ms. */
export const FADE_OUT_MS = 600;

/*
 * A palette holds the literal colours of one showcase image, so the file
 * renders anywhere: `background` (fill of the whole image), `ink` (strokes
 * and marks of the sigils), `text` (caption: the word) and `muted` (caption:
 * the method).
 */

/**
 * "Gold on black" theme of tokens.css: `--color-surface` behind,
 * `--sigil-stroke` (`--color-accent`) for the ink, as the SVG export does.
 */
export const GOLD_ON_BLACK = {
  background: '#1a1814',
  ink: '#d2ae5c',
  text: '#ece5d5',
  muted: '#a89e8a',
};

/**
 * "Ink on paper" theme of tokens.css: `--color-surface`, `--sigil-stroke`
 * (`--color-text`), `--color-text` and `--color-text-muted`.
 */
export const INK_ON_PAPER = {
  background: '#faf7f0',
  ink: '#1c1914',
  text: '#1c1914',
  muted: '#5b5345',
};

/** Pixel size written on the animated image; the drawing stays in its 0–100 `viewBox`. */
const TRACE_IMAGE_SIZE = 400;

/** Columns of the example sheet: four sigils side by side read well at README width. */
const SHEET_COLUMNS = 4;

/** Blank around the sheet and between its cells, in frame units. */
const SHEET_PADDING = 8;

/** Height under each sigil for its two caption lines, in frame units. */
const SHEET_CAPTION_HEIGHT = 24;

/** Baselines of the word and of the method, below the sigil's frame, in frame units. */
const CAPTION_WORD_BASELINE = 6;
const CAPTION_METHOD_BASELINE = 15;

/** Font sizes of the word and of the method, in frame units (16 px and 10 px at 2 px per unit). */
const CAPTION_WORD_SIZE = 8;
const CAPTION_METHOD_SIZE = 5;

/** Pixels per frame unit written on the sheet's `width` and `height`. */
const SHEET_PIXELS_PER_UNIT = 2;

/** Decimals kept in keyframe percentages: a thousandth of a percent is under 0.1 ms here. */
const PERCENT_DECIMALS = 3;

/** Namespace of SVG elements, required for the file to open outside a browser page. */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Schedules one loop of the tracing exactly as the app's renderer does
 * (`SigilRenderer.css`): start mark fades in, strokes are traced in order at
 * constant speed with a pen lift between two strokes, the whole capped by
 * `traceTimeScale`, then the other marks fade in. The loop then holds the
 * complete sigil for `HOLD_MS` and fades it out in `FADE_OUT_MS`.
 *
 * @param strokes - Polylines of the sigil in tracing order, as drawn
 *   (`fittedDrawing`); at least one.
 * @returns The timeline of one loop, all moments in ms from its start:
 *   `strokes`, one `{ start, end }` window per stroke in tracing order;
 *   `traceEnd`, when the last stroke ends and the end marks start fading in;
 *   `complete`, when the whole sigil is drawn; `cycle`, the length of one
 *   loop, hold and fade-out included, rounded up to a whole ms so the CSS
 *   duration and the keyframes agree; `easing`, the timing function of each
 *   stroke (`EASE_TRACE` for a single path, kamea; `linear` for several
 *   strokes, Spare; as in the app).
 * @throws {RangeError} When there is no stroke.
 */
export function traceTimeline(strokes) {
  if (strokes.length === 0) {
    throw new RangeError('Cannot animate a sigil without strokes.');
  }
  const scale = traceTimeScale(strokes.length);
  const traceTime = TRACE_DURATION_MS * scale;
  const penLift = PEN_LIFT_MS * scale;
  const windows = traceSchedule(strokes).map((timing) => {
    const start = FADE_MS + traceTime * timing.offset + penLift * timing.penLiftsBefore;
    return { start, end: start + traceTime * timing.share };
  });
  const traceEnd = FADE_MS + traceTime + penLift * (strokes.length - 1);
  const complete = traceEnd + FADE_MS;
  return {
    strokes: windows,
    traceEnd,
    complete,
    cycle: Math.ceil(complete + HOLD_MS + FADE_OUT_MS),
    easing: strokes.length > 1 ? 'linear' : EASE_TRACE,
  };
}

/**
 * Writes a looping animated SVG of a sigil being traced.
 *
 * Without CSS animation support, or under `prefers-reduced-motion: reduce`,
 * the file shows the complete sigil, still: every element is drawn by its
 * attributes, and all the motion lives in a
 * `@media (prefers-reduced-motion: no-preference)` block.
 *
 * @param sigil - Sigil built by the app (kamea or Spare), at least one stroke.
 * @param palette - Literal colours; only `background` and `ink` are used.
 * @param title - Text of the `<title>` element (the image's name for
 *   assistive technologies when no `alt` is given); plain text, escaped here.
 * @returns A complete SVG document, UTF-8 text ending with a newline.
 * @throws {RangeError} When the sigil has no stroke.
 */
export function animatedTraceSvg(sigil, palette, title) {
  const drawing = fittedDrawing(sigil, DEFAULT_STYLE_OPTIONS);
  const timeline = traceTimeline(drawing.strokes);
  const cycle = `${String(timeline.cycle)}ms`;

  const startMarks = drawing.marks.filter((mark) => mark.kind === 'start-circle');
  const endMarks = drawing.marks.filter((mark) => mark.kind !== 'start-circle');
  const ink = [
    ...startMarks.map((mark) => markElement(mark, 'mark-start')),
    ...drawing.strokes.map(
      (stroke, index) =>
        `<path${attributes({ class: `stroke-${String(index)}`, d: polylinePathData(stroke), pathLength: '1' })}/>`,
    ),
    ...endMarks.map((mark) => markElement(mark, 'mark-end')),
  ];

  const at = (ms) => percent(ms, timeline.cycle);
  const rules = [
    `.ink{animation:ink-cycle ${cycle} infinite}`,
    `@keyframes ink-cycle{0%,${at(timeline.complete + HOLD_MS)}{opacity:1;animation-timing-function:${EASE_STANDARD}}100%{opacity:0}}`,
    // Spare sigils carry no mark: their rules are left out.
    ...(startMarks.length === 0
      ? []
      : [
          `.mark-start{animation:mark-start ${cycle} infinite}`,
          `@keyframes mark-start{0%{opacity:0;animation-timing-function:${EASE_STANDARD}}${at(FADE_MS)},100%{opacity:1}}`,
        ]),
    ...(endMarks.length === 0
      ? []
      : [
          `.mark-end{animation:mark-end ${cycle} infinite}`,
          `@keyframes mark-end{0%,${at(timeline.traceEnd)}{opacity:0;animation-timing-function:${EASE_STANDARD}}${at(timeline.complete)},100%{opacity:1}}`,
        ]),
    // Hidden until its turn: `visibility` keeps a round cap from showing a dot
    // at the start of a path whose dash has not started yet (as in the app).
    '[class^="stroke-"]{visibility:hidden;stroke-dasharray:1 1;stroke-dashoffset:1}',
    ...timeline.strokes.flatMap((window, index) => {
      const name = `stroke-${String(index)}`;
      return [
        `.${name}{animation:${name} ${cycle} infinite}`,
        `@keyframes ${name}{0%,${at(window.start)}{visibility:hidden;stroke-dashoffset:1;animation-timing-function:${timeline.easing}}${at(window.end)},100%{visibility:visible;stroke-dashoffset:0}}`,
      ];
    }),
  ];

  return svgDocument({
    width: TRACE_IMAGE_SIZE,
    height: TRACE_IMAGE_SIZE,
    viewBox: sigil.viewBox,
    title,
    background: palette.background,
    body: [
      '<style>',
      '@media (prefers-reduced-motion:no-preference){',
      ...rules,
      '}',
      '</style>',
      `<g${inkAttributes(palette.ink)}>`,
      ...ink,
      '</g>',
    ],
  });
}

/**
 * Writes a still sheet of example sigils in a grid of `SHEET_COLUMNS`
 * columns, each captioned with its word and its method. The captions use the
 * generic `serif` family, so the file needs no font.
 *
 * @param examples - Sigils to show, in reading order (left to right, then
 *   top to bottom); at least one. Each has its `sigil` (built by the app, in
 *   its 0–100 frame), its `word` (first caption line, as typed) and its
 *   `method` (second caption line: method and planet or variant).
 * @param palette - Literal colours of the sheet.
 * @param title - Text of the `<title>` element; plain text, escaped here.
 * @returns A complete SVG document, UTF-8 text ending with a newline.
 * @throws {RangeError} When `examples` is empty.
 */
export function exampleSheetSvg(examples, palette, title) {
  if (examples.length === 0) {
    throw new RangeError('The example sheet needs at least one sigil.');
  }
  const first = examples[0].sigil.viewBox;
  const cellWidth = first.width + SHEET_PADDING;
  const cellHeight = first.height + SHEET_CAPTION_HEIGHT + SHEET_PADDING;
  const columns = Math.min(SHEET_COLUMNS, examples.length);
  const rows = Math.ceil(examples.length / SHEET_COLUMNS);
  const width = columns * cellWidth + SHEET_PADDING;
  const height = rows * cellHeight + SHEET_PADDING;

  const cells = examples.map((example, index) => {
    const { viewBox } = example.sigil;
    const left = SHEET_PADDING + (index % SHEET_COLUMNS) * cellWidth;
    const top = SHEET_PADDING + Math.floor(index / SHEET_COLUMNS) * cellHeight;
    const drawing = fittedDrawing(example.sigil, DEFAULT_STYLE_OPTIONS);
    const center = frameCenter(viewBox);
    const captionX = formatCoordinate(center.x - viewBox.x);
    const captionTop = viewBox.height;
    return [
      `<g transform="translate(${formatCoordinate(left - viewBox.x)} ${formatCoordinate(top - viewBox.y)})">`,
      `<g${inkAttributes(palette.ink)}>`,
      ...drawing.marks
        .filter((mark) => mark.kind === 'start-circle')
        .map((mark) => markElement(mark)),
      ...drawing.strokes.map((stroke) => `<path${attributes({ d: polylinePathData(stroke) })}/>`),
      ...drawing.marks
        .filter((mark) => mark.kind !== 'start-circle')
        .map((mark) => markElement(mark)),
      '</g>',
      `<text${attributes({ x: captionX, y: formatCoordinate(captionTop + CAPTION_WORD_BASELINE), class: 'word' })}>${escapeXml(example.word)}</text>`,
      `<text${attributes({ x: captionX, y: formatCoordinate(captionTop + CAPTION_METHOD_BASELINE), class: 'method' })}>${escapeXml(example.method)}</text>`,
      '</g>',
    ];
  });

  return svgDocument({
    width: width * SHEET_PIXELS_PER_UNIT,
    height: height * SHEET_PIXELS_PER_UNIT,
    viewBox: { x: 0, y: 0, width, height },
    title,
    background: palette.background,
    body: [
      '<style>',
      `text{font-family:serif;text-anchor:middle}`,
      `.word{font-size:${String(CAPTION_WORD_SIZE)}px;fill:${palette.text}}`,
      `.method{font-size:${String(CAPTION_METHOD_SIZE)}px;letter-spacing:0.08em;fill:${palette.muted}}`,
      '</style>',
      ...cells.flat(),
    ],
  });
}

/**
 * Wraps a body in a standalone SVG document with a full background.
 *
 * @param options - What the document holds.
 * @param options.width - Pixel width written on the root, positive.
 * @param options.height - Pixel height written on the root, positive.
 * @param options.viewBox - Box of the drawing, in frame units.
 * @param options.title - Text of the `<title>` element, unescaped.
 * @param options.background - Literal colour of the full background.
 * @param options.body - Lines of markup drawn over the background.
 * @returns The document, XML declaration included, ending with a newline.
 */
function svgDocument({ width, height, viewBox, title, background, body }) {
  const box = [viewBox.x, viewBox.y, viewBox.width, viewBox.height].map(formatCoordinate);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg${attributes({ xmlns: SVG_NAMESPACE, width: formatCoordinate(width), height: formatCoordinate(height), viewBox: box.join(' ') })}>`,
    `<title>${escapeXml(title)}</title>`,
    `<rect${attributes({ x: box[0], y: box[1], width: box[2], height: box[3], fill: background })}/>`,
    ...body,
    '</svg>',
    '',
  ].join('\n');
}

/**
 * Attributes of the group holding a sigil's ink: the app's default stroke
 * width and round line ends, one colour for strokes and marks (both themes
 * draw marks in the stroke colour).
 *
 * @param color - Literal ink colour.
 * @returns ` name="value"` pairs for the `<g>` element.
 */
function inkAttributes(color) {
  const lineEnds = lineEndsFor(DEFAULT_STYLE_OPTIONS.roundEnds);
  return attributes({
    class: 'ink',
    fill: 'none',
    stroke: color,
    'stroke-width': formatCoordinate(DEFAULT_STYLE_OPTIONS.strokeWidth),
    'stroke-linecap': lineEnds.strokeLinecap,
    'stroke-linejoin': lineEnds.strokeLinejoin,
    'stroke-miterlimit':
      lineEnds.strokeMiterlimit === undefined ? undefined : String(lineEnds.strokeMiterlimit),
  });
}

/**
 * Writes one mark, already resized and fitted, as the SVG export does.
 *
 * @param mark - Mark to draw (start circle, end bar or loop).
 * @param className - Class of the element, if any (animation of the mark).
 * @returns A `<line>` for the end bar, a `<circle>` for the start circle and loops.
 */
function markElement(mark, className) {
  if (mark.kind === 'end-bar') {
    const [from, to] = endBarEndpoints(mark, mark.length);
    return `<line${attributes({
      class: className,
      x1: formatCoordinate(from.x),
      y1: formatCoordinate(from.y),
      x2: formatCoordinate(to.x),
      y2: formatCoordinate(to.y),
    })}/>`;
  }
  return `<circle${attributes({
    class: className,
    cx: formatCoordinate(mark.center.x),
    cy: formatCoordinate(mark.center.y),
    r: formatCoordinate(mark.radius),
  })}/>`;
}

/**
 * Position of a moment within the loop, as a keyframe selector.
 *
 * @param ms - Moment from the loop start, in [0, cycle].
 * @param cycle - Length of the loop, in ms, positive.
 * @returns A percentage such as `12.5%`, rounded to `PERCENT_DECIMALS`.
 */
function percent(ms, cycle) {
  return `${String(Number(((ms / cycle) * 100).toFixed(PERCENT_DECIMALS)))}%`;
}

/**
 * Serialises XML attributes, skipping undefined values.
 *
 * @param values - Attribute names mapped to their raw (unescaped) values.
 * @returns ` name="value"` pairs in insertion order, each value escaped.
 */
function attributes(values) {
  return Object.entries(values)
    .filter((entry) => entry[1] !== undefined)
    .map(([name, value]) => ` ${name}="${escapeXml(value)}"`)
    .join('');
}

/**
 * Escapes the characters that would break XML text or a double-quoted attribute.
 *
 * @param text - Raw text.
 * @returns The text with `&`, `<`, `>` and `"` replaced by entities.
 */
function escapeXml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
