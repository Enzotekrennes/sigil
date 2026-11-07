/**
 * Shape of the texts the explanation panels (kamea and Spare) need, so that
 * the panels hold no wording of their own and the interface language stays
 * in one module per language (`src/app/strings.fr.ts`).
 *
 * Types only.
 */
import type { Planet, SpareRemovedLetter } from '../sigil/types.ts';

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

/** Clockwise quarter turns a Spare letter can receive, other than none. */
export type SpareTurn = 90 | 180 | 270;

/** Every text of the Spare explanation, in the interface language. */
export interface SpareExplanationStrings {
  /** Title of step 1, the letters removed and retained (decision D4). */
  readonly reductionTitle: string;
  /** The reduction rule in one or two sentences, depending on the vowel option. */
  readonly reductionBody: (keepVowels: boolean) => string;
  /** Accessible name of the strip of the intention's letters. */
  readonly stripLabel: (count: number) => string;
  /** Screen-reader status of one letter of the strip: kept, or removed and why. */
  readonly letterStatus: (reason: SpareRemovedLetter['reason'] | null) => string;
  /** Label of the line listing the duplicates removed. */
  readonly duplicatesLabel: string;
  /** Label of the line listing the vowels removed. */
  readonly vowelsLabel: string;
  /** Label of the line listing the letters retained. */
  readonly keptLabel: string;
  /** Said on a line that lists no letter. */
  readonly noneRemoved: string;

  /** Title of step 2, the single-stroke skeletons and their transforms. */
  readonly skeletonsTitle: string;
  /** What happens to each retained letter before the merge. */
  readonly skeletonsBody: string;
  /** Accessible name of the list of letter tiles. */
  readonly skeletonsLabel: string;
  /** Transform text of a letter drawn as written. */
  readonly upright: string;
  /** Transform text of a letter flipped left to right. */
  readonly mirrored: string;
  /** Transform text of each clockwise turn. */
  readonly turns: Readonly<Record<SpareTurn, string>>;
  /** Transform text of the size, in percent of the largest possible letter. */
  readonly scale: (percent: number) => string;
  /** Transform text of a vertical stem shared with another letter. */
  readonly sharedStem: (letter: string) => string;
  /** Caption of the drawing of the letters laid on top of each other. */
  readonly superimposedTitle: string;
  /** Accessible name of that drawing. */
  readonly superimposedLabel: (count: number) => string;

  /** Title of step 3, the composition chosen among the candidates (decision D13). */
  readonly choiceTitle: string;
  /** One sentence: which composition, out of how many, and why. `number` is 1-based. */
  readonly choiceBody: (number: number, count: number) => string;

  /** Title of step 4, the merge and simplification of the strokes. */
  readonly simplificationTitle: string;
  /** The merge in one sentence, with the segment counts before and after (equal when nothing overlapped). */
  readonly simplificationBody: (before: number, after: number) => string;
}
