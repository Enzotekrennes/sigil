/**
 * Name of an exported file: neutral by design (decision D8), it says which
 * method drew the sigil and when, never the intention nor anything derived
 * from it.
 *
 * Exposes `exportFileName`, `ExportFormat` and `SigilMethod`. Pure.
 */

/** File formats offered by the export dialog. */
export type ExportFormat = 'svg' | 'png' | 'pdf';

/** Method that produced the exported sigil. */
export type SigilMethod = 'kamea' | 'spare';

/**
 * Builds `sigil-<method>-<YYYYMMDD-HHMMSS>.<format>`, with the local date and
 * time so that two exports in a row sort in order and rarely collide.
 *
 * @param method - Method of the sigil.
 * @param format - File format, also the extension.
 * @param date - Moment of the export, read in the local time zone.
 * @returns For instance `sigil-kamea-20261108-093005.svg`.
 */
export function exportFileName(method: SigilMethod, format: ExportFormat, date: Date): string {
  const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(twoDigits).join('');
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()].map(twoDigits).join('');
  return `sigil-${method}-${day}-${time}.${format}`;
}

/**
 * Writes a date or time part with at least two digits.
 *
 * @param value - Non-negative integer (the year keeps its four digits).
 * @returns The value padded with a leading zero below 10.
 */
function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}
