/**
 * Geometry of the frame every sigil is drawn in, shared by the methods
 * (kamea, Spare) and the renderer so that a value lives in one place.
 *
 * Exposes the side of the normalised square, the empty margin around the
 * drawing and the stroke width marks are sized for. Pure constants: fitting a
 * drawing into the frame belongs to each method.
 */

/** Side of the normalised square frame shared by every sigil (coordinates 0–100). */
export const FRAME_SIZE = 100;

/**
 * Empty band around the drawing, so that the stroke width, the marks and the
 * optional framing circle never touch the border: the design's 800-in-1000
 * drawing area ("Sigil stroke" section of the design document).
 */
export const FRAME_MARGIN = 10;

/** Side of the square the drawing itself occupies, inside the margin. */
export const DRAWING_SIZE = FRAME_SIZE - 2 * FRAME_MARGIN;

/**
 * Stroke width the methods size their marks for, in frame units: the design
 * default of 12 in a 1000-unit frame. The renderer rescales marks by
 * `strokeWidth / MARK_REFERENCE_STROKE_WIDTH`.
 */
export const MARK_REFERENCE_STROKE_WIDTH = 1.2;
