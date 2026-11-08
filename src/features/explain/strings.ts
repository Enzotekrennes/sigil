/**
 * Shape of the texts the explanation panels (kamea and Spare) need, so that
 * the panels hold no wording of their own and the interface language stays
 * in one module per language (`src/app/strings.fr.ts`, `src/app/strings.en.ts`).
 *
 * Types only.
 */
import type {
  Planet,
  SpareAttachment,
  SpareRemovedLetter,
  SpareRuneStyle,
  SpareStemAttachment,
} from '../sigil/types.ts';

/** Column headings of the letter → number table. */
export interface LetterTableHeadings {
  /** Heading of the column of the intention's letters (A–Z). */
  readonly letter: string;
  /** Heading of the column of alphabetical ranks (A = 1 … Z = 26). */
  readonly rank: string;
  /** Heading of the column of numbers in the square (1 … N²). */
  readonly number: string;
}

/** Every text of the kamea explanation, in the interface language. */
export interface KameaExplanationStrings {
  /** Planet name with its preposition and article ("de Saturne", "du Soleil", "of the Sun"). */
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
  /**
   * Label of the line listing the duplicates removed, with its colon written
   * the way the language writes it ("Doublons :" with a no-break space in
   * French, "Duplicates:" in English); the panel adds no punctuation.
   */
  readonly duplicatesLabel: string;
  /** Label of the line listing the vowels removed, colon included as for `duplicatesLabel`. */
  readonly vowelsLabel: string;
  /** Label of the line listing the letters retained, colon included as for `duplicatesLabel`. */
  readonly keptLabel: string;
  /** Said on a line that lists no letter. */
  readonly noneRemoved: string;

  /** Title of step 2, the letters redrawn with straight segments (decision D20). */
  readonly skeletonsTitle: string;
  /**
   * How a letter becomes angular, and how its tile reads: the original letter
   * drawn faint, its angular skeleton drawn bold (said without colour words,
   * the colours change with the theme).
   */
  readonly skeletonsBody: string;
  /** Accessible name of the list of letter tiles. */
  readonly skeletonsLabel: string;
  /** Segment count of one angular skeleton, under its letter. */
  readonly segmentCount: (count: number) => string;

  /** Title of step 3, the stem and the letters hooked onto it (decision D19). */
  readonly attachmentsTitle: string;
  /** The stem and the three ways a letter hooks onto it, named as in `attachment`. */
  readonly attachmentsBody: string;
  /** Accessible name of the list of hooked letters, given from the top of the stem down. */
  readonly attachmentsLabel: string;
  /** Name of each way of hooking a letter onto the stem. */
  readonly attachment: Readonly<Record<SpareAttachment, string>>;
  /** Said of a letter flipped left to right, when it is not doubled. */
  readonly mirrored: string;
  /** Said of a letter drawn twice, mirror images of each other on both sides of the stem. */
  readonly doubled: string;
  /** Side of the stem a single letter occupies. */
  readonly side: Readonly<Record<SpareStemAttachment['side'], string>>;
  /** Accessible name of the drawing of the rune before merging, the stem in bold. */
  readonly runeLabel: (letterCount: number) => string;
  /** Caption of that drawing, saying which line is the stem. */
  readonly runeCaption: string;

  /** Title of step 4, the variant's style and the rune chosen (decision D21). */
  readonly choiceTitle: string;
  /** One sentence per variant style: which letters are doubled and how the sides answer each other. */
  readonly styleBody: Readonly<Record<SpareRuneStyle, string>>;
  /** One sentence: which rune, out of how many, and why. `number` is 1-based. */
  readonly choiceBody: (number: number, count: number) => string;

  /** Title of step 5, the merge of the stem and the letters into one drawing. */
  readonly simplificationTitle: string;
  /**
   * The merge, with the segment counts before and after. The count can drop
   * (overlaps drawn once), stay equal, or rise (a stroke covered only in part
   * is cut around the shared part); the text must hold in all three cases.
   */
  readonly simplificationBody: (before: number, after: number) => string;
}
