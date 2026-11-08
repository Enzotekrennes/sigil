/**
 * Types of the single-stroke letter skeletons used by the Spare method
 * (plan decision D7): the shape of the generated Hershey data and the glyph
 * handed to the composition.
 *
 * Glyph frame, shared by every glyph: Hershey font units, x grows to the
 * right from the glyph's left side bearing (x = 0), y grows downwards from the
 * baseline (y = 0), so capitals span y = −21 (cap top) to y = 0. This is not
 * the 0–100 sigil frame of `Sigil`: the composition scales glyphs into it.
 */
import type { Box, Point } from '../../sigil/types.ts';

/** An upper-case Latin letter, the alphabet the Spare method composes. */
export type CapitalLetter =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z';

/**
 * One capital letter as generated from the Hershey data, with its provenance.
 *
 * The provenance fields (`hersheyId`, `hersheyRecord`, `hersheyLeft`,
 * `hersheyRight`) are not read by the app, yet stay in the generated module
 * and so in the bundle (about 2.5 kB before compression for the 26 letters):
 * the idempotence test of the regeneration rebuilds the source file from
 * them, and they let the committed data be checked against its source record
 * by record. Splitting
 * them into a separate module would change the generator, its tests and the
 * committed file for no gain worth the risk.
 */
export interface HersheyGlyphRecord {
  /** Hershey glyph number in the NBS repertoire (Roman Simplex A = 501 … Z = 526). */
  readonly hersheyId: number;
  /**
   * Source record exactly as distributed, in James Hurt's format: left and
   * right bearings followed by the vertex pairs, " R" marking a pen-up. Kept
   * so that the data can be checked against, and regenerated from, its source.
   */
  readonly hersheyRecord: string;
  /** Left side bearing in raw Hershey units, relative to the glyph's centre line. */
  readonly hersheyLeft: number;
  /** Right side bearing in raw Hershey units, relative to the glyph's centre line. */
  readonly hersheyRight: number;
  /** Horizontal advance: distance between the side bearings, in glyph units. */
  readonly advance: number;
  /** Tight bounding box of every stroke point, in the glyph frame. */
  readonly bounds: Box;
  /** Pen strokes in drawing order; each one is a polyline of at least two points. */
  readonly strokes: readonly (readonly Point[])[];
}

/** A letter skeleton ready for composition, in the glyph frame. */
export interface Glyph {
  /** Pen strokes in drawing order; each one is a polyline of at least two points. */
  readonly strokes: readonly (readonly Point[])[];
  /** Horizontal advance between the side bearings, in glyph units. */
  readonly advance: number;
  /** Tight bounding box of every stroke point, in the glyph frame. */
  readonly bounds: Box;
}
