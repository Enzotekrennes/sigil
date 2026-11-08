/**
 * Deterministic pseudo-randomness shared by the generative methods (plan
 * decision D6): a string hash to derive seeds and a seeded generator to draw
 * from them, so that the same settings always give the same sigil.
 *
 * Exposes `cyrb53` (string → 53-bit integer), `mulberry32` (32-bit seed →
 * generator), `createRandom` (53-bit seed → generator) and the drawing
 * helper `randomBetween`. Not suitable for anything security related: these
 * are fast, well-distributed, predictable algorithms by design. Never uses `Math.random`.
 *
 * @packageDocumentation
 */

/** A generator of numbers uniformly spread over [0, 1), like `Math.random`. */
export type RandomSource = () => number;

/** 2³², the size of the 32-bit state of `mulberry32`. */
const UINT32_RANGE = 4294967296;

/**
 * Hashes a string into a 53-bit unsigned integer with cyrb53 (public-domain
 * algorithm by bryc), well mixed so that close strings give unrelated hashes.
 *
 * @param text - Any string; it is read as UTF-16 code units.
 * @param salt - Optional 32-bit integer giving an independent hash family; 0 by default.
 * @returns An integer in [0, 2⁵³), always a safe integer. Same input, same result.
 */
export function cyrb53(text: string, salt = 0): number {
  let h1 = 0xdeadbeef ^ salt;
  let h2 = 0x41c6ce57 ^ salt;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  // 21 high bits from h2, 32 low bits from h1: 53 bits, the safe-integer limit.
  return UINT32_RANGE * (0x1fffff & h2) + (h1 >>> 0);
}

/**
 * Creates a Mulberry32 generator (public-domain algorithm by Tommy Ettinger):
 * a 32-bit state advanced by a constant, then scrambled. Period 2³², ample for
 * the few hundred draws of a sigil.
 *
 * @param seed - Initial state; only its low 32 bits are used.
 * @returns A generator of numbers in [0, 1). Each call advances its own state;
 *   two generators made from the same seed give the same sequence.
 */
export function mulberry32(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

/**
 * Creates a generator from a 53-bit seed such as a `cyrb53` hash. The high
 * bits are folded into the low 32 bits, so seeds that differ only above bit 32
 * still give different sequences.
 *
 * @param seed - Non-negative safe integer, typically from `cyrb53`.
 * @returns A Mulberry32 generator of numbers in [0, 1).
 */
export function createRandom(seed: number): RandomSource {
  const low = seed % UINT32_RANGE;
  const high = Math.floor(seed / UINT32_RANGE);
  return mulberry32((low ^ high) >>> 0);
}

/**
 * Draws a real number uniformly between two bounds.
 *
 * @param random - Generator to draw from; advanced by one step.
 * @param min - Lower bound, included.
 * @param max - Upper bound, excluded; must not be below `min`.
 * @returns A number in [min, max).
 */
export function randomBetween(random: RandomSource, min: number, max: number): number {
  return min + random() * (max - min);
}
