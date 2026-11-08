/**
 * The "how it is made" panel of a Spare sigil, a bind rune, in five numbered
 * steps: letters removed (duplicates, vowels) and retained; each retained
 * letter redrawn with straight segments (D20); the stem and how each letter
 * hooks onto it (D19); the variant's style and the rune chosen among the
 * candidates (D21); the merge of the shared strokes.
 *
 * Exposes `SpareExplanation`. Reads everything from the sigil's explanation
 * steps (`features/spare` produces them); holds no wording, every text comes
 * from `strings`. The intention is never written into an attribute, only
 * shown as letters on screen, marked `translate="no"` so a browser's page
 * translation leaves them as they were drawn.
 */
import { VisuallyHidden } from '../../components/ui/index.ts';
import { FRAME_MARGIN, FRAME_SIZE } from '../sigil/frame.ts';
import type { Box, Sigil, SpareStemAttachment } from '../sigil/types.ts';
import './ExplanationSteps.css';
import './SpareExplanation.css';
import {
  attachmentsFromTop,
  lettersRemovedFor,
  readSpareSteps,
  removalByPosition,
  stemStroke,
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
  width: FRAME_SIZE - 2 * (FRAME_MARGIN - GLYPH_VIEW_PADDING),
  height: FRAME_SIZE - 2 * (FRAME_MARGIN - GLYPH_VIEW_PADDING),
};

/** Separator between the parts of an attachment description. */
const DETAIL_SEPARATOR = ' · ';

/** Props of `SpareExplanation`. */
export interface SpareExplanationProps {
  /** Sigil drawn by the Spare method. Another method's sigil renders nothing. */
  readonly sigil: Sigil;
  /** Texts in the interface language. */
  readonly strings: SpareExplanationStrings;
}

/**
 * Renders the five steps as an ordered list.
 *
 * @returns The list of steps, or `null` when the sigil carries no Spare steps.
 */
export function SpareExplanation({ sigil, strings }: SpareExplanationProps) {
  const steps = readSpareSteps(sigil.steps);
  if (steps === undefined) return null;

  const { reduction, skeletons, attachments, choice, simplification } = steps;
  const removal = removalByPosition(reduction.removed);
  const duplicates = lettersRemovedFor(reduction.removed, 'duplicate');
  const vowels = lettersRemovedFor(reduction.removed, 'vowel');
  const hooked = attachmentsFromTop(attachments);
  const hookedStrokes = attachments.letters.flatMap((attachment) => attachment.strokes);

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
                <span translate="no">{letter}</span>
                <VisuallyHidden>{strings.letterStatus(reason)}</VisuallyHidden>
              </li>
            );
          })}
        </ol>
        <dl className="spare-removal">
          <div className="spare-removal__row">
            <dt>{strings.duplicatesLabel}</dt>
            <dd translate={lettersTranslate(duplicates)}>
              {lettersOrNone(duplicates, strings.noneRemoved)}
            </dd>
          </div>
          {!reduction.keepVowels && (
            <div className="spare-removal__row">
              <dt>{strings.vowelsLabel}</dt>
              <dd translate={lettersTranslate(vowels)}>
                {lettersOrNone(vowels, strings.noneRemoved)}
              </dd>
            </div>
          )}
          <div className="spare-removal__row spare-removal__row--kept">
            <dt>{strings.keptLabel}</dt>
            <dd translate="no">{reduction.kept.join(' ')}</dd>
          </div>
        </dl>
      </li>

      <li className="explain-steps__step">
        <h3 className="explain-steps__title">{strings.skeletonsTitle}</h3>
        <p className="explain-steps__text">{strings.skeletonsBody}</p>
        <ul className="glyph-tiles" aria-label={strings.skeletonsLabel}>
          {skeletons.letters.map((skeleton) => (
            // Retained letters are distinct: the letter is the identity.
            <li key={skeleton.letter} className="glyph-tile">
              <StrokeDrawing
                strokes={skeleton.angular}
                context={skeleton.glyph}
                viewBox={GLYPH_VIEW}
                className="glyph-tile__drawing"
              />
              <span className="glyph-tile__letter" translate="no">
                {skeleton.letter}
              </span>
              <span className="glyph-tile__count">
                {strings.segmentCount(skeleton.segmentCount)}
              </span>
            </li>
          ))}
        </ul>
      </li>

      <li className="explain-steps__step">
        <h3 className="explain-steps__title">{strings.attachmentsTitle}</h3>
        <p className="explain-steps__text">{strings.attachmentsBody}</p>
        <div className="spare-rune">
          <figure className="spare-rune__figure">
            <StrokeDrawing
              strokes={[stemStroke(attachments)]}
              context={hookedStrokes}
              viewBox={sigil.viewBox}
              className="spare-rune__drawing"
              label={strings.runeLabel(attachments.letters.length)}
            />
            <figcaption className="spare-rune__caption">{strings.runeCaption}</figcaption>
          </figure>
          <ol className="spare-attachments" aria-label={strings.attachmentsLabel}>
            {hooked.map((attachment) => (
              <li key={attachment.letter} className="spare-attachments__letter">
                <span className="spare-attachments__name" translate="no">
                  {attachment.letter}
                </span>
                <span className="spare-attachments__detail">
                  {describeAttachment(attachment, strings)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </li>

      <li className="explain-steps__step">
        <h3 className="explain-steps__title">{strings.choiceTitle}</h3>
        <p className="explain-steps__text">{strings.styleBody[choice.style]}</p>
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
 * `translate` attribute of a removal line: letters are kept out of a
 * browser's page translation, the "none" word is left to it.
 *
 * @param letters - Letters the line lists.
 * @returns `"no"` when the line shows letters, `undefined` for the "none" word.
 */
function lettersTranslate(letters: readonly string[]): 'no' | undefined {
  return letters.length === 0 ? undefined : 'no';
}

/**
 * Words how one letter hangs on the stem: the way it is hooked, then its
 * mirror, its double or its side, whichever tells something.
 *
 * A doubled letter sits on both sides as two mirror images, so neither its
 * mirror nor its side is said; a centred letter is crossed by the stem, so
 * its side goes without saying. A single letter whose vertical lies on the
 * stem and which still spreads to both sides (T, Y) is symmetric about that
 * vertical: its mirror changes nothing visible and is not said either.
 *
 * @param attachment - The letter's attachment in the chosen rune.
 * @param strings - Texts in the interface language.
 * @returns Parts joined by a middle dot, for instance "sur la hampe · en miroir · à gauche".
 */
function describeAttachment(
  attachment: SpareStemAttachment,
  strings: SpareExplanationStrings,
): string {
  const parts = [strings.attachment[attachment.attachment]];
  if (attachment.doubled) {
    parts.push(strings.doubled);
    return parts.join(DETAIL_SEPARATOR);
  }
  const straddlesStem = attachment.attachment === 'stem' && attachment.side === 'both';
  if (attachment.mirrored && !straddlesStem) parts.push(strings.mirrored);
  if (attachment.attachment !== 'centre') parts.push(strings.side[attachment.side]);
  return parts.join(DETAIL_SEPARATOR);
}
