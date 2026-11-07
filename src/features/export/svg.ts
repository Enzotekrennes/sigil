/**
 * Builds the standalone SVG file of a sigil from its model and style
 * settings: the same paths and marks as the final on-screen drawing (marks
 * resized to the stroke width, drawing fitted inside the framing circle when
 * it is shown), on a square background, with literal colours.
 *
 * Exposes `buildSigilSvg`, `ExportPalette`, `EXPORT_SVG_SIZE` and
 * `EXPORT_SVG_TITLE`. Pure: the colours are passed in (see `palette.ts`),
 * nothing reads the DOM. Never serialises the rendered `<svg>`: the export
 * carries no class, no `style`, no `pathLength`, no animation and no
 * accessible name, so neither the intention nor the app's CSS can leak in.
 */
import {
  formatCoordinate,
  fittedDrawing,
  frameCenter,
  FRAME_CIRCLE_RADIUS,
  lineEndsFor,
  endBarEndpoints,
  polylinePathData,
  showsFrameCircle,
} from '../sigil/index.ts';
import type { Mark, Sigil, StyleOptions } from '../sigil/types.ts';

/** Literal colours of an export, already resolved from the theme tokens. */
export interface ExportPalette {
  /** Fill of the square background (theme surface, or stencil white). */
  readonly background: string;
  /** Colour of the strokes. */
  readonly stroke: string;
  /** Colour of the marks (start circle, end bar, loops). */
  readonly marker: string;
  /** Colour of the framing circle. */
  readonly frame: string;
}

/**
 * Pixel size written on the SVG file (`width` and `height`): large enough to
 * open sharp in a viewer, small enough for a vector editor's default artboard.
 * The drawing itself stays in the 0–100 `viewBox`, so it scales freely.
 */
export const EXPORT_SVG_SIZE = 1024;

/**
 * Title of every exported file: the product name only, never the intention
 * nor anything derived from it.
 */
export const EXPORT_SVG_TITLE = 'Sigil';

/** Namespace of SVG elements, required for the file to open outside a browser page. */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Writes the SVG markup of a sigil as it is finally drawn on screen.
 *
 * Order of the elements follows the renderer: start circle, strokes, other
 * marks, framing circle; a full background rectangle comes first.
 *
 * @param sigil - Sigil to export, whole (a step-by-step replay is ignored).
 * @param styleOptions - Style settings shown: width, ends, framing circle, mode.
 * @param palette - Literal colours; written as given, so they must be valid
 *   SVG paint values (see `readExportPalette`).
 * @param size - Pixel width and height written on the root, a positive integer.
 * @returns A complete SVG document (XML declaration included), UTF-8 text.
 * @throws {RangeError} When `size` is not a positive integer.
 */
export function buildSigilSvg(
  sigil: Sigil,
  styleOptions: StyleOptions,
  palette: ExportPalette,
  size: number = EXPORT_SVG_SIZE,
): string {
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError(`SVG export size must be a positive integer, got ${String(size)}.`);
  }
  const { strokeWidth } = styleOptions;
  const center = frameCenter(sigil.viewBox);
  const withFrame = showsFrameCircle(styleOptions);
  // Same strokes and marks as the renderer's final drawing.
  const drawing = fittedDrawing(sigil, styleOptions);
  const lineEnds = lineEndsFor(styleOptions.roundEnds);
  const { x, y, width, height } = sigil.viewBox;

  const groupAttributes = attributes({
    fill: 'none',
    'stroke-width': formatCoordinate(strokeWidth),
    'stroke-linecap': lineEnds.strokeLinecap,
    'stroke-linejoin': lineEnds.strokeLinejoin,
    'stroke-miterlimit':
      lineEnds.strokeMiterlimit === undefined ? undefined : String(lineEnds.strokeMiterlimit),
  });
  const startMarks = drawing.marks.filter((mark) => mark.kind === 'start-circle');
  const otherMarks = drawing.marks.filter((mark) => mark.kind !== 'start-circle');
  const ink = [
    ...startMarks.map((mark) => markElement(mark, palette.marker)),
    ...drawing.strokes.map(
      (stroke) => `<path${attributes({ d: polylinePathData(stroke), stroke: palette.stroke })}/>`,
    ),
    ...otherMarks.map((mark) => markElement(mark, palette.marker)),
  ];
  if (withFrame) {
    ink.push(
      `<circle${attributes({
        cx: formatCoordinate(center.x),
        cy: formatCoordinate(center.y),
        r: formatCoordinate(FRAME_CIRCLE_RADIUS),
        stroke: palette.frame,
      })}/>`,
    );
  }

  const viewBox = [x, y, width, height].map(formatCoordinate).join(' ');
  const rootAttributes = attributes({
    xmlns: SVG_NAMESPACE,
    width: String(size),
    height: String(size),
    viewBox,
  });
  const background = `<rect${attributes({
    x: formatCoordinate(x),
    y: formatCoordinate(y),
    width: formatCoordinate(width),
    height: formatCoordinate(height),
    fill: palette.background,
  })}/>`;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg${rootAttributes}>`,
    `<title>${escapeXml(EXPORT_SVG_TITLE)}</title>`,
    background,
    `<g${groupAttributes}>`,
    ...ink,
    '</g>',
    '</svg>',
    '',
  ].join('\n');
}

/**
 * Writes one mark, already resized and fitted.
 *
 * @param mark - Mark to draw.
 * @param color - Literal stroke colour.
 * @returns A `<line>` for the end bar, a `<circle>` for the start circle and loops.
 */
function markElement(mark: Mark, color: string): string {
  if (mark.kind === 'end-bar') {
    const [from, to] = endBarEndpoints(mark, mark.length);
    return `<line${attributes({
      x1: formatCoordinate(from.x),
      y1: formatCoordinate(from.y),
      x2: formatCoordinate(to.x),
      y2: formatCoordinate(to.y),
      stroke: color,
    })}/>`;
  }
  return `<circle${attributes({
    cx: formatCoordinate(mark.center.x),
    cy: formatCoordinate(mark.center.y),
    r: formatCoordinate(mark.radius),
    stroke: color,
  })}/>`;
}

/**
 * Serialises XML attributes, skipping undefined values.
 *
 * @param values - Attribute names mapped to their raw (unescaped) values.
 * @returns ` name="value"` pairs in insertion order, each value escaped.
 */
function attributes(values: Readonly<Record<string, string | undefined>>): string {
  return Object.entries(values)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([name, value]) => ` ${name}="${escapeXml(value)}"`)
    .join('');
}

/**
 * Escapes the characters that would break XML text or a double-quoted attribute.
 *
 * @param text - Raw text.
 * @returns The text with `&`, `<`, `>` and `"` replaced by entities.
 */
function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
