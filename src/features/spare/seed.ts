/**
 * Seed of the Spare method (plan decision D6): a hash of everything that
 * shapes the sigil and nothing else, so that two intentions reducing to the
 * same letters with the same settings give the same sigil, and each variant
 * number gives its own, repeatable, sigil.
 *
 * Exposes `spareSeed` and its input type. Does not draw anything: the seed
 * feeds `createRandom` in the composition.
 */
import { cyrb53 } from '../../lib/random.ts';

/** Everything that determines a Spare sigil. */
export interface SpareSeedInput {
  /** Retained letters after the Spare reduction, in order, upper-case A–Z. */
  readonly letters: readonly string[];
  /**
   * Whether vowels were kept. Part of the seed even though it already changes
   * the letters, so that the setting alone gives a different family of sigils
   * when the intention has no vowel to lose.
   */
  readonly keepVowels: boolean;
  /** Variant number, 0 for the first sigil, incremented by "another variant". */
  readonly variant: number;
}

/** Method name written into the hashed key, so that methods never share seeds. */
const METHOD_KEY = 'spare';

/**
 * Derives the seed of a Spare sigil.
 *
 * @param input - Retained letters, vowel setting and variant number.
 * @returns A non-negative safe integer (53 bits). The same input always gives
 *   the same seed; changing any field, including the variant, gives another one.
 * @throws {RangeError} When `variant` is not a non-negative safe integer.
 */
export function spareSeed(input: SpareSeedInput): number {
  const { letters, keepVowels, variant } = input;
  if (!Number.isSafeInteger(variant) || variant < 0) {
    throw new RangeError(`Invalid variant ${String(variant)}: expected an integer ≥ 0.`);
  }
  // Fields are separated by a character that cannot appear in a letter, so
  // that no two different inputs produce the same key.
  const key = [METHOD_KEY, letters.join(''), keepVowels ? 'vowels' : 'consonants', String(variant)];
  return cyrb53(key.join('|'));
}
