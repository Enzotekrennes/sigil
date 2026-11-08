/**
 * Public API of the explanation feature: the "how it is made" panels of a
 * kamea sigil and of a Spare sigil, and the shape of the texts they need.
 *
 * The panels only display the explanation steps a method recorded in
 * `Sigil.steps`; they compute nothing about the sigil themselves, and receive
 * their texts from the app's dictionaries rather than holding any.
 *
 * @packageDocumentation
 */
export { KameaExplanation } from './KameaExplanation.tsx';
export type { KameaExplanationProps } from './KameaExplanation.tsx';
export { SpareExplanation } from './SpareExplanation.tsx';
export type { SpareExplanationProps } from './SpareExplanation.tsx';
export type {
  KameaExplanationStrings,
  LetterTableHeadings,
  SpareExplanationStrings,
} from './strings.ts';
