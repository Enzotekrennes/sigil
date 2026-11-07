/**
 * Hands a file to the browser as a download, without any network request:
 * a temporary `<a download>` on a Blob URL, clicked then removed.
 *
 * Exposes `downloadBlob` and `REVOKE_DELAY_MS`.
 */

/**
 * Delay before the Blob URL is revoked, in milliseconds. Some browsers read
 * the URL after the click returns; a few seconds is ample for a file of a few
 * hundred kilobytes, and the memory is released right after.
 */
export const REVOKE_DELAY_MS = 10_000;

/**
 * Starts the download of a Blob under a given name.
 *
 * @param blob - File content.
 * @param fileName - Name proposed to the user; must not contain the intention.
 * @remarks Adds and removes a hidden link in `document.body`, and schedules
 *   the revocation of its Blob URL after `REVOKE_DELAY_MS`.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  // Firefox only follows a click on a link that is in the document.
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_DELAY_MS);
}
