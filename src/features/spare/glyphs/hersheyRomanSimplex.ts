/**
 * Hershey Roman Simplex capitals A–Z as single-stroke polylines, the letter
 * skeletons of the Spare method (plan decision D7).
 *
 * Generated file, do not edit by hand. Regenerate with:
 *   node --experimental-strip-types scripts/generate-hershey-glyphs.js <path to rowmans.jhf>
 * Source: https://github.com/kamalmostafa/hershey-fonts/blob/master/hershey-fonts/rowmans.jhf
 * (records 501–526 identical to the 1986 Usenet distribution, mod.sources
 * volume 4, issue 42).
 *
 * Coordinates are in the glyph frame described in `types.ts`: Hershey units,
 * x from the left side bearing, y downwards from the baseline.
 *
 * Acknowledgements required by the Hershey Fonts distribution notice:
 * - The Hershey Fonts were originally created by Dr. A. V. Hershey while
 *   working at the U. S. National Bureau of Standards.
 * - The format of the Font data in this distribution was originally created by
 *   James Hurt, Cognition, Inc., 900 Technology Park Drive, Billerica, MA 01821
 *   (mit-eddie!ci-dandelion!hurt).
 * Converted from that format into TypeScript coordinates; see NOTICE.
 */
import type { CapitalLetter, HersheyGlyphRecord } from './types.ts';

/** Roman Simplex capitals by letter, with their Hershey provenance. */
export const ROMAN_SIMPLEX_CAPITALS: Readonly<Record<CapitalLetter, HersheyGlyphRecord>> = {
  A: {
    hersheyId: 501,
    hersheyRecord: 'I[RFJ[ RRFZ[ RMTWT',
    hersheyLeft: -9,
    hersheyRight: 9,
    advance: 18,
    bounds: { x: 1, y: -21, width: 16, height: 21 },
    strokes: [
      [
        { x: 9, y: -21 },
        { x: 1, y: 0 },
      ],
      [
        { x: 9, y: -21 },
        { x: 17, y: 0 },
      ],
      [
        { x: 4, y: -7 },
        { x: 14, y: -7 },
      ],
    ],
  },
  B: {
    hersheyId: 502,
    hersheyRecord: 'G\\KFK[ RKFTFWGXHYJYLXNWOTP RKPTPWQXRYTYWXYWZT[K[',
    hersheyLeft: -11,
    hersheyRight: 10,
    advance: 21,
    bounds: { x: 4, y: -21, width: 14, height: 21 },
    strokes: [
      [
        { x: 4, y: -21 },
        { x: 4, y: 0 },
      ],
      [
        { x: 4, y: -21 },
        { x: 13, y: -21 },
        { x: 16, y: -20 },
        { x: 17, y: -19 },
        { x: 18, y: -17 },
        { x: 18, y: -15 },
        { x: 17, y: -13 },
        { x: 16, y: -12 },
        { x: 13, y: -11 },
      ],
      [
        { x: 4, y: -11 },
        { x: 13, y: -11 },
        { x: 16, y: -10 },
        { x: 17, y: -9 },
        { x: 18, y: -7 },
        { x: 18, y: -4 },
        { x: 17, y: -2 },
        { x: 16, y: -1 },
        { x: 13, y: 0 },
        { x: 4, y: 0 },
      ],
    ],
  },
  C: {
    hersheyId: 503,
    hersheyRecord: 'H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZV',
    hersheyLeft: -10,
    hersheyRight: 11,
    advance: 21,
    bounds: { x: 3, y: -21, width: 15, height: 21 },
    strokes: [
      [
        { x: 18, y: -16 },
        { x: 17, y: -18 },
        { x: 15, y: -20 },
        { x: 13, y: -21 },
        { x: 9, y: -21 },
        { x: 7, y: -20 },
        { x: 5, y: -18 },
        { x: 4, y: -16 },
        { x: 3, y: -13 },
        { x: 3, y: -8 },
        { x: 4, y: -5 },
        { x: 5, y: -3 },
        { x: 7, y: -1 },
        { x: 9, y: 0 },
        { x: 13, y: 0 },
        { x: 15, y: -1 },
        { x: 17, y: -3 },
        { x: 18, y: -5 },
      ],
    ],
  },
  D: {
    hersheyId: 504,
    hersheyRecord: 'G\\KFK[ RKFRFUGWIXKYNYSXVWXUZR[K[',
    hersheyLeft: -11,
    hersheyRight: 10,
    advance: 21,
    bounds: { x: 4, y: -21, width: 14, height: 21 },
    strokes: [
      [
        { x: 4, y: -21 },
        { x: 4, y: 0 },
      ],
      [
        { x: 4, y: -21 },
        { x: 11, y: -21 },
        { x: 14, y: -20 },
        { x: 16, y: -18 },
        { x: 17, y: -16 },
        { x: 18, y: -13 },
        { x: 18, y: -8 },
        { x: 17, y: -5 },
        { x: 16, y: -3 },
        { x: 14, y: -1 },
        { x: 11, y: 0 },
        { x: 4, y: 0 },
      ],
    ],
  },
  E: {
    hersheyId: 505,
    hersheyRecord: 'H[LFL[ RLFYF RLPTP RL[Y[',
    hersheyLeft: -10,
    hersheyRight: 9,
    advance: 19,
    bounds: { x: 4, y: -21, width: 13, height: 21 },
    strokes: [
      [
        { x: 4, y: -21 },
        { x: 4, y: 0 },
      ],
      [
        { x: 4, y: -21 },
        { x: 17, y: -21 },
      ],
      [
        { x: 4, y: -11 },
        { x: 12, y: -11 },
      ],
      [
        { x: 4, y: 0 },
        { x: 17, y: 0 },
      ],
    ],
  },
  F: {
    hersheyId: 506,
    hersheyRecord: 'HZLFL[ RLFYF RLPTP',
    hersheyLeft: -10,
    hersheyRight: 8,
    advance: 18,
    bounds: { x: 4, y: -21, width: 13, height: 21 },
    strokes: [
      [
        { x: 4, y: -21 },
        { x: 4, y: 0 },
      ],
      [
        { x: 4, y: -21 },
        { x: 17, y: -21 },
      ],
      [
        { x: 4, y: -11 },
        { x: 12, y: -11 },
      ],
    ],
  },
  G: {
    hersheyId: 507,
    hersheyRecord: 'H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZVZS RUSZS',
    hersheyLeft: -10,
    hersheyRight: 11,
    advance: 21,
    bounds: { x: 3, y: -21, width: 15, height: 21 },
    strokes: [
      [
        { x: 18, y: -16 },
        { x: 17, y: -18 },
        { x: 15, y: -20 },
        { x: 13, y: -21 },
        { x: 9, y: -21 },
        { x: 7, y: -20 },
        { x: 5, y: -18 },
        { x: 4, y: -16 },
        { x: 3, y: -13 },
        { x: 3, y: -8 },
        { x: 4, y: -5 },
        { x: 5, y: -3 },
        { x: 7, y: -1 },
        { x: 9, y: 0 },
        { x: 13, y: 0 },
        { x: 15, y: -1 },
        { x: 17, y: -3 },
        { x: 18, y: -5 },
        { x: 18, y: -8 },
      ],
      [
        { x: 13, y: -8 },
        { x: 18, y: -8 },
      ],
    ],
  },
  H: {
    hersheyId: 508,
    hersheyRecord: 'G]KFK[ RYFY[ RKPYP',
    hersheyLeft: -11,
    hersheyRight: 11,
    advance: 22,
    bounds: { x: 4, y: -21, width: 14, height: 21 },
    strokes: [
      [
        { x: 4, y: -21 },
        { x: 4, y: 0 },
      ],
      [
        { x: 18, y: -21 },
        { x: 18, y: 0 },
      ],
      [
        { x: 4, y: -11 },
        { x: 18, y: -11 },
      ],
    ],
  },
  I: {
    hersheyId: 509,
    hersheyRecord: 'NVRFR[',
    hersheyLeft: -4,
    hersheyRight: 4,
    advance: 8,
    bounds: { x: 4, y: -21, width: 0, height: 21 },
    strokes: [
      [
        { x: 4, y: -21 },
        { x: 4, y: 0 },
      ],
    ],
  },
  J: {
    hersheyId: 510,
    hersheyRecord: 'JZVFVVUYTZR[P[NZMYLVLT',
    hersheyLeft: -8,
    hersheyRight: 8,
    advance: 16,
    bounds: { x: 2, y: -21, width: 10, height: 21 },
    strokes: [
      [
        { x: 12, y: -21 },
        { x: 12, y: -5 },
        { x: 11, y: -2 },
        { x: 10, y: -1 },
        { x: 8, y: 0 },
        { x: 6, y: 0 },
        { x: 4, y: -1 },
        { x: 3, y: -2 },
        { x: 2, y: -5 },
        { x: 2, y: -7 },
      ],
    ],
  },
  K: {
    hersheyId: 511,
    hersheyRecord: 'G\\KFK[ RYFKT RPOY[',
    hersheyLeft: -11,
    hersheyRight: 10,
    advance: 21,
    bounds: { x: 4, y: -21, width: 14, height: 21 },
    strokes: [
      [
        { x: 4, y: -21 },
        { x: 4, y: 0 },
      ],
      [
        { x: 18, y: -21 },
        { x: 4, y: -7 },
      ],
      [
        { x: 9, y: -12 },
        { x: 18, y: 0 },
      ],
    ],
  },
  L: {
    hersheyId: 512,
    hersheyRecord: 'HYLFL[ RL[X[',
    hersheyLeft: -10,
    hersheyRight: 7,
    advance: 17,
    bounds: { x: 4, y: -21, width: 12, height: 21 },
    strokes: [
      [
        { x: 4, y: -21 },
        { x: 4, y: 0 },
      ],
      [
        { x: 4, y: 0 },
        { x: 16, y: 0 },
      ],
    ],
  },
  M: {
    hersheyId: 513,
    hersheyRecord: 'F^JFJ[ RJFR[ RZFR[ RZFZ[',
    hersheyLeft: -12,
    hersheyRight: 12,
    advance: 24,
    bounds: { x: 4, y: -21, width: 16, height: 21 },
    strokes: [
      [
        { x: 4, y: -21 },
        { x: 4, y: 0 },
      ],
      [
        { x: 4, y: -21 },
        { x: 12, y: 0 },
      ],
      [
        { x: 20, y: -21 },
        { x: 12, y: 0 },
      ],
      [
        { x: 20, y: -21 },
        { x: 20, y: 0 },
      ],
    ],
  },
  N: {
    hersheyId: 514,
    hersheyRecord: 'G]KFK[ RKFY[ RYFY[',
    hersheyLeft: -11,
    hersheyRight: 11,
    advance: 22,
    bounds: { x: 4, y: -21, width: 14, height: 21 },
    strokes: [
      [
        { x: 4, y: -21 },
        { x: 4, y: 0 },
      ],
      [
        { x: 4, y: -21 },
        { x: 18, y: 0 },
      ],
      [
        { x: 18, y: -21 },
        { x: 18, y: 0 },
      ],
    ],
  },
  O: {
    hersheyId: 515,
    hersheyRecord: 'G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF',
    hersheyLeft: -11,
    hersheyRight: 11,
    advance: 22,
    bounds: { x: 3, y: -21, width: 16, height: 21 },
    strokes: [
      [
        { x: 9, y: -21 },
        { x: 7, y: -20 },
        { x: 5, y: -18 },
        { x: 4, y: -16 },
        { x: 3, y: -13 },
        { x: 3, y: -8 },
        { x: 4, y: -5 },
        { x: 5, y: -3 },
        { x: 7, y: -1 },
        { x: 9, y: 0 },
        { x: 13, y: 0 },
        { x: 15, y: -1 },
        { x: 17, y: -3 },
        { x: 18, y: -5 },
        { x: 19, y: -8 },
        { x: 19, y: -13 },
        { x: 18, y: -16 },
        { x: 17, y: -18 },
        { x: 15, y: -20 },
        { x: 13, y: -21 },
        { x: 9, y: -21 },
      ],
    ],
  },
  P: {
    hersheyId: 516,
    hersheyRecord: 'G\\KFK[ RKFTFWGXHYJYMXOWPTQKQ',
    hersheyLeft: -11,
    hersheyRight: 10,
    advance: 21,
    bounds: { x: 4, y: -21, width: 14, height: 21 },
    strokes: [
      [
        { x: 4, y: -21 },
        { x: 4, y: 0 },
      ],
      [
        { x: 4, y: -21 },
        { x: 13, y: -21 },
        { x: 16, y: -20 },
        { x: 17, y: -19 },
        { x: 18, y: -17 },
        { x: 18, y: -14 },
        { x: 17, y: -12 },
        { x: 16, y: -11 },
        { x: 13, y: -10 },
        { x: 4, y: -10 },
      ],
    ],
  },
  Q: {
    hersheyId: 517,
    hersheyRecord: 'G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF RSWY]',
    hersheyLeft: -11,
    hersheyRight: 11,
    advance: 22,
    bounds: { x: 3, y: -21, width: 16, height: 23 },
    strokes: [
      [
        { x: 9, y: -21 },
        { x: 7, y: -20 },
        { x: 5, y: -18 },
        { x: 4, y: -16 },
        { x: 3, y: -13 },
        { x: 3, y: -8 },
        { x: 4, y: -5 },
        { x: 5, y: -3 },
        { x: 7, y: -1 },
        { x: 9, y: 0 },
        { x: 13, y: 0 },
        { x: 15, y: -1 },
        { x: 17, y: -3 },
        { x: 18, y: -5 },
        { x: 19, y: -8 },
        { x: 19, y: -13 },
        { x: 18, y: -16 },
        { x: 17, y: -18 },
        { x: 15, y: -20 },
        { x: 13, y: -21 },
        { x: 9, y: -21 },
      ],
      [
        { x: 12, y: -4 },
        { x: 18, y: 2 },
      ],
    ],
  },
  R: {
    hersheyId: 518,
    hersheyRecord: 'G\\KFK[ RKFTFWGXHYJYLXNWOTPKP RRPY[',
    hersheyLeft: -11,
    hersheyRight: 10,
    advance: 21,
    bounds: { x: 4, y: -21, width: 14, height: 21 },
    strokes: [
      [
        { x: 4, y: -21 },
        { x: 4, y: 0 },
      ],
      [
        { x: 4, y: -21 },
        { x: 13, y: -21 },
        { x: 16, y: -20 },
        { x: 17, y: -19 },
        { x: 18, y: -17 },
        { x: 18, y: -15 },
        { x: 17, y: -13 },
        { x: 16, y: -12 },
        { x: 13, y: -11 },
        { x: 4, y: -11 },
      ],
      [
        { x: 11, y: -11 },
        { x: 18, y: 0 },
      ],
    ],
  },
  S: {
    hersheyId: 519,
    hersheyRecord: 'H\\YIWGTFPFMGKIKKLMMNOOUQWRXSYUYXWZT[P[MZKX',
    hersheyLeft: -10,
    hersheyRight: 10,
    advance: 20,
    bounds: { x: 3, y: -21, width: 14, height: 21 },
    strokes: [
      [
        { x: 17, y: -18 },
        { x: 15, y: -20 },
        { x: 12, y: -21 },
        { x: 8, y: -21 },
        { x: 5, y: -20 },
        { x: 3, y: -18 },
        { x: 3, y: -16 },
        { x: 4, y: -14 },
        { x: 5, y: -13 },
        { x: 7, y: -12 },
        { x: 13, y: -10 },
        { x: 15, y: -9 },
        { x: 16, y: -8 },
        { x: 17, y: -6 },
        { x: 17, y: -3 },
        { x: 15, y: -1 },
        { x: 12, y: 0 },
        { x: 8, y: 0 },
        { x: 5, y: -1 },
        { x: 3, y: -3 },
      ],
    ],
  },
  T: {
    hersheyId: 520,
    hersheyRecord: 'JZRFR[ RKFYF',
    hersheyLeft: -8,
    hersheyRight: 8,
    advance: 16,
    bounds: { x: 1, y: -21, width: 14, height: 21 },
    strokes: [
      [
        { x: 8, y: -21 },
        { x: 8, y: 0 },
      ],
      [
        { x: 1, y: -21 },
        { x: 15, y: -21 },
      ],
    ],
  },
  U: {
    hersheyId: 521,
    hersheyRecord: 'G]KFKULXNZQ[S[VZXXYUYF',
    hersheyLeft: -11,
    hersheyRight: 11,
    advance: 22,
    bounds: { x: 4, y: -21, width: 14, height: 21 },
    strokes: [
      [
        { x: 4, y: -21 },
        { x: 4, y: -6 },
        { x: 5, y: -3 },
        { x: 7, y: -1 },
        { x: 10, y: 0 },
        { x: 12, y: 0 },
        { x: 15, y: -1 },
        { x: 17, y: -3 },
        { x: 18, y: -6 },
        { x: 18, y: -21 },
      ],
    ],
  },
  V: {
    hersheyId: 522,
    hersheyRecord: 'I[JFR[ RZFR[',
    hersheyLeft: -9,
    hersheyRight: 9,
    advance: 18,
    bounds: { x: 1, y: -21, width: 16, height: 21 },
    strokes: [
      [
        { x: 1, y: -21 },
        { x: 9, y: 0 },
      ],
      [
        { x: 17, y: -21 },
        { x: 9, y: 0 },
      ],
    ],
  },
  W: {
    hersheyId: 523,
    hersheyRecord: 'F^HFM[ RRFM[ RRFW[ R\\FW[',
    hersheyLeft: -12,
    hersheyRight: 12,
    advance: 24,
    bounds: { x: 2, y: -21, width: 20, height: 21 },
    strokes: [
      [
        { x: 2, y: -21 },
        { x: 7, y: 0 },
      ],
      [
        { x: 12, y: -21 },
        { x: 7, y: 0 },
      ],
      [
        { x: 12, y: -21 },
        { x: 17, y: 0 },
      ],
      [
        { x: 22, y: -21 },
        { x: 17, y: 0 },
      ],
    ],
  },
  X: {
    hersheyId: 524,
    hersheyRecord: 'H\\KFY[ RYFK[',
    hersheyLeft: -10,
    hersheyRight: 10,
    advance: 20,
    bounds: { x: 3, y: -21, width: 14, height: 21 },
    strokes: [
      [
        { x: 3, y: -21 },
        { x: 17, y: 0 },
      ],
      [
        { x: 17, y: -21 },
        { x: 3, y: 0 },
      ],
    ],
  },
  Y: {
    hersheyId: 525,
    hersheyRecord: 'I[JFRPR[ RZFRP',
    hersheyLeft: -9,
    hersheyRight: 9,
    advance: 18,
    bounds: { x: 1, y: -21, width: 16, height: 21 },
    strokes: [
      [
        { x: 1, y: -21 },
        { x: 9, y: -11 },
        { x: 9, y: 0 },
      ],
      [
        { x: 17, y: -21 },
        { x: 9, y: -11 },
      ],
    ],
  },
  Z: {
    hersheyId: 526,
    hersheyRecord: 'H\\YFK[ RKFYF RK[Y[',
    hersheyLeft: -10,
    hersheyRight: 10,
    advance: 20,
    bounds: { x: 3, y: -21, width: 14, height: 21 },
    strokes: [
      [
        { x: 17, y: -21 },
        { x: 3, y: 0 },
      ],
      [
        { x: 3, y: -21 },
        { x: 17, y: -21 },
      ],
      [
        { x: 3, y: 0 },
        { x: 17, y: 0 },
      ],
    ],
  },
};
