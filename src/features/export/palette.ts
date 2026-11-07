/**
 * Resolves the colours of an export from the design tokens currently applied
 * to the page, so the file looks like the scene in the current theme ("ink on
 * paper" or "gold on black"), or pure black on white in stencil mode.
 *
 * Exposes `readExportPalette` and `EXPORT_COLOR_TOKENS`. Reads computed styles
 * only; writes nothing. The values are checked to be literal colours, so an
 * export never carries a `var(--…)` that only means something inside the app.
 */
import type { RenderMode } from '../sigil/types.ts';
import type { ExportPalette } from './svg.ts';

/** Token read for each colour of the palette, per render mode (see `src/styles/tokens.css`). */
export const EXPORT_COLOR_TOKENS: Readonly<
  Record<RenderMode, Readonly<Record<keyof ExportPalette, string>>>
> = {
  // The scene is the only surface-coloured element: the export keeps that paper.
  screen: {
    background: '--color-surface',
    stroke: '--sigil-stroke',
    marker: '--sigil-marker',
    frame: '--sigil-frame',
  },
  // Theme-independent on purpose; stencil mode draws no framing circle.
  stencil: {
    background: '--stencil-bg',
    stroke: '--stencil-stroke',
    marker: '--stencil-stroke',
    frame: '--stencil-stroke',
  },
};

/**
 * Literal CSS colours accepted in an export: hex, a colour function with
 * plain arguments, or a keyword. Anything else (empty, `var(`, a URL) is refused.
 */
const LITERAL_COLOR =
  /^(#[0-9a-f]{3,8}|(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([\w\s.,%/+-]*\)|[a-z]+)$/i;

/**
 * Reads the export colours for a render mode from the tokens in effect.
 *
 * @param mode - `screen` follows the current theme, `stencil` is black on white.
 * @param root - Element whose computed custom properties are read; the
 *   document root, where the theme tokens are declared.
 * @returns The four literal colours, trimmed.
 * @throws {Error} When a token is missing or does not resolve to a literal
 *   colour (a renamed token in `tokens.css`, or a browser that does not
 *   substitute `var()` in computed custom properties).
 */
export function readExportPalette(
  mode: RenderMode,
  root: Element = document.documentElement,
): ExportPalette {
  const computed = getComputedStyle(root);
  const tokens = EXPORT_COLOR_TOKENS[mode];
  /**
   * Reads and checks one token.
   *
   * @param token - Custom property name, `--` included.
   * @returns Its literal colour.
   */
  const read = (token: string): string => {
    const value = computed.getPropertyValue(token).trim();
    if (!LITERAL_COLOR.test(value)) {
      throw new Error(
        `Cannot export: token ${token} resolves to "${value}", not a literal colour. Check src/styles/tokens.css.`,
      );
    }
    return value;
  };
  return {
    background: read(tokens.background),
    stroke: read(tokens.stroke),
    marker: read(tokens.marker),
    frame: read(tokens.frame),
  };
}
