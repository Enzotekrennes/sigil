/**
 * Layout of a kamea square in the sigil's 0–100 frame: the square fills the
 * shared drawing area (`DRAWING_SIZE`), inside the frame margin
 * (`FRAME_MARGIN`). One definition for the method, which draws the path
 * through the cell centres, and for the explanation panel, which draws the
 * square under that path.
 *
 * Exposes `kameaCellSize` and `kameaCellCenter`. Pure functions.
 */
import { DRAWING_SIZE, FRAME_MARGIN } from '../sigil/frame.ts';
import type { GridCell, Point } from '../sigil/types.ts';

/**
 * Side of one cell of an N × N square, in frame units.
 *
 * @param order - Side N of the square, positive.
 * @returns The cell side: 26.7 for Saturn (3 × 3) down to 8.9 for the Moon (9 × 9).
 */
export function kameaCellSize(order: number): number {
  return DRAWING_SIZE / order;
}

/**
 * Centre of a cell once the square is laid in the frame, where the path passes.
 *
 * @param cell - Zero-based cell, from the top-left corner.
 * @param order - Side N of the square, positive.
 * @returns The centre in frame units.
 */
export function kameaCellCenter(cell: GridCell, order: number): Point {
  const size = kameaCellSize(order);
  return {
    x: FRAME_MARGIN + (cell.column + 0.5) * size,
    y: FRAME_MARGIN + (cell.row + 0.5) * size,
  };
}
