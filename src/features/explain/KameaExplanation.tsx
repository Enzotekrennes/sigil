/**
 * The "how it is made" panel of a kamea sigil, in four numbered steps:
 * normalised letters (and characters left out), the conversion rule with a
 * worked example, the letter → number table, and the square with the path.
 *
 * Exposes `KameaExplanation`. Reads everything from the sigil's explanation
 * steps. Holds no wording: every text comes from `strings`. The characters
 * left out by the normalisation are reported once, under the form, not here.
 * The intention itself is never written into an attribute, only shown as
 * letters on screen.
 */
import { VisuallyHidden } from '../../components/ui/index.ts';
import type { Sigil } from '../sigil/types.ts';
import './ExplanationSteps.css';
import './KameaExplanation.css';
import { KameaGrid } from './KameaGrid.tsx';
import { conversionExample, readKameaSteps, ruleWraps } from './kameaSteps.ts';
import type { KameaExplanationStrings } from './strings.ts';

/** Props of `KameaExplanation`. */
export interface KameaExplanationProps {
  /** Sigil drawn by the kamea method. Another method's sigil renders nothing. */
  readonly sigil: Sigil;
  /** Texts in the interface language. */
  readonly strings: KameaExplanationStrings;
}

/**
 * Renders the four steps as an ordered list.
 *
 * @returns The list of steps, or `null` when the sigil carries no kamea steps.
 */
export function KameaExplanation({ sigil, strings }: KameaExplanationProps) {
  const steps = readKameaSteps(sigil.steps);
  if (steps === undefined) return null;

  const { rule, table, path } = steps;
  const planetOf = strings.planetOf[rule.planet];
  const letters = table.entries.map((entry) => entry.letter);
  const example = conversionExample(table.entries, rule.cellCount);
  const wraps = ruleWraps(rule.cellCount);
  const loopCount = sigil.marks.filter((mark) => mark.kind === 'loop').length;

  return (
    <ol className="explain-steps explain-steps--kamea">
      <li className="explain-steps__step">
        <h3 className="explain-steps__title">{strings.lettersTitle}</h3>
        <p className="explain-steps__text">{strings.lettersBody}</p>
        <p className="explain-steps__letters">
          <VisuallyHidden>{strings.lettersLabel(letters.length)}</VisuallyHidden>
          {letters.join('')}
        </p>
      </li>

      <li className="explain-steps__step">
        <h3 className="explain-steps__title">{strings.ruleTitle}</h3>
        <p className="explain-steps__text">
          {wraps ? strings.ruleBody(planetOf, rule.cellCount) : strings.ruleNoWrap(rule.cellCount)}
        </p>
        <p className="kamea-steps__formula">{strings.ruleFormula(rule.cellCount)}</p>
        {example !== undefined && (
          <p className="kamea-steps__example">
            {strings.ruleExample(example.letter, example.rank, rule.cellCount, example.number)}
          </p>
        )}
        {rule.planet === 'saturn' && (
          <p className="explain-steps__text explain-steps__note">{strings.rulePythagorean}</p>
        )}
      </li>

      <li className="explain-steps__step">
        <h3 className="explain-steps__title">{strings.tableTitle}</h3>
        <div className="letter-table">
          <div className="letter-table__headings" aria-hidden="true">
            <span>{strings.tableHeadings.letter}</span>
            <span>{strings.tableHeadings.rank}</span>
            <span>{strings.tableHeadings.number}</span>
          </div>
          <ol className="letter-table__entries" aria-label={strings.tableLabel}>
            {table.entries.map((entry, index) => (
              // Letters repeat and never reorder: the position is the identity.
              <li key={index} className="letter-table__entry">
                <VisuallyHidden>
                  {strings.tableEntry(entry.letter, entry.rank, entry.number)}
                </VisuallyHidden>
                <span className="letter-table__letter" aria-hidden="true">
                  {entry.letter}
                </span>
                <span className="letter-table__rank" aria-hidden="true">
                  {entry.rank}
                </span>
                <span className="letter-table__number" aria-hidden="true">
                  {entry.number}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </li>

      <li className="explain-steps__step kamea-steps__path">
        <h3 className="explain-steps__title">{strings.pathTitle}</h3>
        <p className="explain-steps__text">{strings.pathBody}</p>
        <KameaGrid
          sigil={sigil}
          square={path.square}
          cells={path.cells}
          label={strings.gridLabel(planetOf, rule.order, path.numbers)}
        />
        <p className="kamea-steps__sequence">
          <span className="kamea-steps__sequence-label">{strings.pathSequenceLabel}</span>{' '}
          {path.numbers.join(' → ')}
        </p>
        {loopCount > 0 && (
          <p className="explain-steps__text explain-steps__note">{strings.loopCount(loopCount)}</p>
        )}
      </li>
    </ol>
  );
}
