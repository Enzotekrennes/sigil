/**
 * The "how it is made" panel of a Spare sigil, in four numbered steps:
 * letters removed (duplicates, vowels) and retained, the single-stroke
 * skeletons with the transform each one received and then laid on top of
 * each other, the composition chosen among the candidates, and the merge of
 * the strokes.
 *
 * Exposes `SpareExplanation`. Reads everything from the sigil's explanation
 * steps (`features/spare` produces them); holds no wording, every text comes
 * from `strings`. The intention is never written into an attribute, only
 * shown as letters on screen.
 */
import { VisuallyHidden } from '../../components/ui/index.ts';
import { FRAME_MARGIN } from '../sigil/frame.ts';
import type { Box, Sigil, SpareLetterPlacement } from '../sigil/types.ts';
import './ExplanationSteps.css';
import './SpareExplanation.css';
import {
  lettersRemovedFor,
  readSpareSteps,
  removalByPosition,
  scalePercent,
} from './spareSteps.ts';
import type { SpareExplanationStrings } from './strings.ts';
import { StrokeDrawing } from './StrokeDrawing.tsx';

/**
 * Room kept around an upright skeleton, in frame units: the skeleton spans
 * the drawing area (10–90), and 2 more units keep its round ends unclipped.
 */
const GLYPH_VIEW_PADDING = 2;

/** Part of the frame shown in a letter tile: the drawing area and its padding. */
const GLYPH_VIEW: Box = {
  x: FRAME_MARGIN - GLYPH_VIEW_PADDING,
  y: FRAME_MARGIN - GLYPH_VIEW_PADDING,
  width: 100 - 2 * (FRAME_MARGIN - GLYPH_VIEW_PADDING),
  height: 100 - 2 * (FRAME_MARGIN - GLYPH_VIEW_PADDING),
};

/** Separator between the parts of a transform description. */
const TRANSFORM_SEPARATOR = ' · ';

/** Props of `SpareExplanation`. */
export interface SpareExplanationProps {
  /** Sigil drawn by the Spare method. Another method's sigil renders nothing. */
  readonly sigil: Sigil;
  /** Texts in the interface language. */
  readonly strings: SpareExplanationStrings;
}

/**
 * Renders the four steps as an ordered list.
 *
 * @returns The list of steps, or `null` when the sigil carries no Spare steps.
 */
export function SpareExplanation({ sigil, strings }: SpareExplanationProps) {
  const steps = readSpareSteps(sigil.steps);
  if (steps === undefined) return null;

  const { reduction, placements, choice, simplification } = steps;
  const removal = removalByPosition(reduction.removed);
  const duplicates = lettersRemovedFor(reduction.removed, 'duplicate');
  const vowels = lettersRemovedFor(reduction.removed, 'vowel');
  const superimposed = placements.letters.flatMap((placement) => placement.strokes);

  return (
    <ol className="explain-steps explain-steps--spare">
      <li className="explain-steps__step">
        <h3 className="explain-steps__title">{strings.reductionTitle}</h3>
        <p className="explain-steps__text">{strings.reductionBody(reduction.keepVowels)}</p>
        <ol className="letter-strip" aria-label={strings.stripLabel(reduction.letters.length)}>
          {reduction.letters.map((letter, position) => {
            const reason = removal.get(position) ?? null;
            return (
              // Letters repeat and never reorder: the position is the identity.
              <li
                key={position}
                className={
                  reason === null ? 'letter-strip__letter' : 'letter-strip__letter is-removed'
                }
              >
                {letter}
                <VisuallyHidden>{strings.letterStatus(reason)}</VisuallyHidden>
              </li>
            );
          })}
        </ol>
        <dl className="spare-removal">
          <div className="spare-removal__row">
            <dt>{strings.duplicatesLabel}</dt>
            <dd>{lettersOrNone(duplicates, strings.noneRemoved)}</dd>
          </div>
          {!reduction.keepVowels && (
            <div className="spare-removal__row">
              <dt>{strings.vowelsLabel}</dt>
              <dd>{lettersOrNone(vowels, strings.noneRemoved)}</dd>
            </div>
          )}
          <div className="spare-removal__row spare-removal__row--kept">
            <dt>{strings.keptLabel}</dt>
            <dd>{reduction.kept.join(' ')}</dd>
          </div>
        </dl>
      </li>

      <li className="explain-steps__step spare-steps__skeletons">
        <h3 className="explain-steps__title">{strings.skeletonsTitle}</h3>
        <p className="explain-steps__text">{strings.skeletonsBody}</p>
        <ul className="glyph-tiles" aria-label={strings.skeletonsLabel}>
          {placements.letters.map((placement, index) => (
            // One tile per retained letter, all different and in a fixed order.
            <li key={index} className="glyph-tile">
              <StrokeDrawing
                strokes={placement.glyph}
                viewBox={GLYPH_VIEW}
                className="glyph-tile__drawing"
              />
              <span className="glyph-tile__letter">{placement.letter}</span>
              <span className="glyph-tile__transform">
                {describeTransform(placement, placements.letters, strings)}
              </span>
            </li>
          ))}
        </ul>
        <figure className="spare-superimposed">
          <StrokeDrawing
            strokes={superimposed}
            viewBox={sigil.viewBox}
            className="spare-superimposed__drawing"
            label={strings.superimposedLabel(placements.letters.length)}
          />
          <figcaption className="spare-superimposed__caption">
            {strings.superimposedTitle}
          </figcaption>
        </figure>
      </li>

      <li className="explain-steps__step">
        <h3 className="explain-steps__title">{strings.choiceTitle}</h3>
        <p className="explain-steps__text">
          {strings.choiceBody(choice.chosenIndex + 1, choice.candidateCount)}
        </p>
      </li>

      <li className="explain-steps__step">
        <h3 className="explain-steps__title">{strings.simplificationTitle}</h3>
        <p className="explain-steps__text">
          {strings.simplificationBody(
            simplification.segmentCountBefore,
            simplification.segmentCountAfter,
          )}
        </p>
      </li>
    </ol>
  );
}

/**
 * Letters separated by spaces, or the "none" word for an empty list.
 *
 * @param letters - Letters to list.
 * @param none - Text shown when there is no letter.
 * @returns The text of a removal line.
 */
function lettersOrNone(letters: readonly string[], none: string): string {
  return letters.length === 0 ? none : letters.join(' ');
}

/**
 * Words what was done to one letter before the merge: mirror, turn, size and
 * shared stem, in the order they apply.
 *
 * @param placement - The letter's placement in the chosen composition.
 * @param letters - Every placement, to name the letter whose stem is shared.
 * @param strings - Texts in the interface language.
 * @returns Parts joined by a middle dot, for instance "miroir · demi-tour · 80 %".
 */
function describeTransform(
  placement: SpareLetterPlacement,
  letters: readonly SpareLetterPlacement[],
  strings: SpareExplanationStrings,
): string {
  const parts: string[] = [];
  if (placement.mirrored) parts.push(strings.mirrored);
  if (placement.rotation !== 0) parts.push(strings.turns[placement.rotation]);
  if (parts.length === 0) parts.push(strings.upright);

  const percent = scalePercent(placement.scale);
  if (percent < 100) parts.push(strings.scale(percent));

  const stemOwner =
    placement.sharedStemWith === null ? undefined : letters[placement.sharedStemWith];
  if (stemOwner !== undefined) parts.push(strings.sharedStem(stemOwner.letter));

  return parts.join(TRANSFORM_SEPARATOR);
}
