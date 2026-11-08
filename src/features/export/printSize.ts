/**
 * Print size of the stencil PDF, as typed by the user in centimetres: the
 * largest dimension of the sigil's ink on paper.
 *
 * Exposes the range (`PRINT_SIZE_MIN_CM`, `PRINT_SIZE_MAX_CM`), the default
 * (`PRINT_SIZE_DEFAULT_CM`), `MM_PER_CM` and `parsePrintSize`, which reads the field and
 * says why a value is refused. Pure. Whether a valid size also fits on the A4
 * page depends on the sigil's proportions: see `layoutStencilPage`.
 */

/** Millimetres per centimetre: the size is typed in centimetres, the geometry works in millimetres. */
export const MM_PER_CM = 10;

/** Smallest print size, in centimetres (plan, F5): below it the line merges at 1.2 mm. */
export const PRINT_SIZE_MIN_CM = 1;

/** Largest print size, in centimetres (plan, F5): the height a portrait A4 page can hold. */
export const PRINT_SIZE_MAX_CM = 25;

/** Size proposed when the dialog first opens, in centimetres (docs/design.md, Export). */
export const PRINT_SIZE_DEFAULT_CM = 8;

/** Why a typed print size is refused. */
export type PrintSizeError = 'not-a-number' | 'out-of-range';

/** A typed print size, read: the centimetres, or why they are refused. */
export type PrintSizeResult =
  | {
      readonly ok: true;
      /** Size read, in centimetres, within `PRINT_SIZE_MIN_CM`–`PRINT_SIZE_MAX_CM`. */
      readonly centimetres: number;
    }
  | { readonly ok: false; readonly error: PrintSizeError };

/**
 * A decimal number written with a point or a comma, as both languages type it,
 * optionally negative (hyphen or the typographic minus U+2212): a negative size
 * is a number out of the range, not a typing error.
 */
const DECIMAL = /^[-\u2212]?\d+(?:[.,]\d+)?$/;

/**
 * Reads a print size typed in the dialog.
 *
 * @param text - Field content, for instance `8`, `6,5` or `6.5`; surrounding
 *   spaces are ignored.
 * @returns The size in centimetres when it is a number within
 *   [`PRINT_SIZE_MIN_CM`, `PRINT_SIZE_MAX_CM`]; otherwise `out-of-range`
 *   for any other number (zero and negatives included), or `not-a-number`
 *   (empty, letters, a lone sign, several separators).
 */
export function parsePrintSize(text: string): PrintSizeResult {
  const trimmed = text.trim();
  if (!DECIMAL.test(trimmed)) return { ok: false, error: 'not-a-number' };
  const centimetres = Number(trimmed.replace(',', '.').replace('\u2212', '-'));
  if (centimetres < PRINT_SIZE_MIN_CM || centimetres > PRINT_SIZE_MAX_CM) {
    return { ok: false, error: 'out-of-range' };
  }
  return { ok: true, centimetres };
}
