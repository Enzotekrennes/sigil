/**
 * Rasterises an SVG document into a PNG, in the browser only (decision D9):
 * SVG text → Blob URL → `Image` → off-screen canvas → PNG Blob. The display
 * stays SVG; the canvas exists only for the duration of an export.
 *
 * Exposes `rasterizeSvg` and `EXPORT_PNG_SIZE`. Needs `Image`, `canvas` and
 * `URL.createObjectURL`; the page's CSP allows `blob:` images for it.
 */

/**
 * Side of the exported PNG in pixels: a sharp square for printing or
 * sharing at full phone width (F4 scenario).
 */
export const EXPORT_PNG_SIZE = 2048;

/**
 * Draws an SVG document on a square canvas and encodes it as PNG.
 *
 * @param svg - Complete SVG document; its own background fills the square
 *   (the canvas starts transparent).
 * @param size - Side of the PNG in pixels, a positive integer.
 * @returns The PNG file content.
 * @throws {Error} When the SVG cannot be decoded as an image, the canvas has
 *   no 2D context, or the browser fails to encode the PNG.
 * @remarks Creates a Blob URL and revokes it before returning, success or failure.
 */
export async function rasterizeSvg(svg: string, size: number = EXPORT_PNG_SIZE): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image(size, size);
    image.src = url;
    try {
      await image.decode();
    } catch (cause) {
      throw new Error('Cannot export PNG: the browser could not decode the sigil SVG.', { cause });
    }
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('Cannot export PNG: no 2D canvas context available.');
    context.drawImage(image, 0, 0, size, size);
    return await canvasToPng(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Encodes a canvas as PNG.
 *
 * @param canvas - Canvas already drawn.
 * @returns The PNG Blob.
 * @throws {Error} When the browser returns no Blob (canvas too large, out of memory).
 */
function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error('Cannot export PNG: the browser could not encode it.'));
      else resolve(blob);
    }, 'image/png');
  });
}
