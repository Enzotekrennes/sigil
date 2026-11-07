/**
 * Shape of the texts the explanation panel needs, so that the panel holds no
 * wording of its own and the interface language stays in one module per
 * language (`src/app/strings.fr.ts`).
 *
 * Types only.
 */
import type { Planet } from '../sigil/types.ts';

/** Column headings of the letter → number table. */
export interface LetterTableHeadings {
  readonly letter: string;
  readonly rank: string;
  readonly number: string;
}

/** Every text of the kamea explanation, in the interface language. */
export interface KameaExplanationStrings {
  /** Planet name with its preposition and article ("de Saturne", "du Soleil"). */
  readonly planetOf: Readonly<Record<Planet, string>>;

  /** Title of step 1, the normalised letters. */
  readonly lettersTitle: string;
  /** What normalisation did, in one or two sentences. */
  readonly lettersBody: string;
  /** Accessible name of the strip of retained letters, given their count. */
  readonly lettersLabel: (count: number) => string;
  /** Sentence listing the characters left out of the trace. */
  readonly ignoredCharacters: (characters: readonly string[]) => string;

  /** Title of step 2, the conversion rule (decision D2). */
  readonly ruleTitle: string;
  /** The rule in words, for a square of `cellCount` cells. */
  readonly ruleBody: (planetOf: string, cellCount: number) => string;
  /** The rule as a formula, for a square of `cellCount` cells. */
  readonly ruleFormula: (cellCount: number) => string;
  /** One letter worked through the formula. */
  readonly ruleExample: (letter: string, rank: number, cellCount: number, number: number) => string;
  /** Said instead of the wrap explanation when the square has at least 26 cells. */
  readonly ruleNoWrap: (cellCount: number) => string;
  /** Note shown on Saturn only, where the rule is the Pythagorean reduction. */
  readonly rulePythagorean: string;

  /** Title of step 3, the letter → number table. */
  readonly tableTitle: string;
  /** Row headings of the table. */
  readonly tableHeadings: LetterTableHeadings;
  /** Accessible name of the table. */
  readonly tableLabel: string;
  /** Full reading of one table entry for screen readers. */
  readonly tableEntry: (letter: string, rank: number, number: number) => string;

  /** Title of step 4, the square with the path. */
  readonly pathTitle: string;
  /** How the path and its marks read. */
  readonly pathBody: string;
  /** Label before the sequence of visited numbers. */
  readonly pathSequenceLabel: string;
  /** Sentence counting the loops (repeated numbers in a row); `count` ≥ 1. */
  readonly loopCount: (count: number) => string;
  /** Accessible name of the square drawing. */
  readonly gridLabel: (planetOf: string, order: number, numbers: readonly number[]) => string;
}
