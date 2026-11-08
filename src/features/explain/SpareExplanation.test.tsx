/**
 * Component tests of the Spare explanation panel: the four steps, the letter
 * strip with the reason of each removal, the transform of each skeleton, the
 * superimposed letters, the chosen candidate and the merge counts.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { STRINGS_FR } from '../../app/strings.fr.ts';
import type { Sigil, SpareLetterPlacement } from '../sigil/types.ts';
import { buildSpareSigil } from '../spare/index.ts';
import { SpareExplanation } from './SpareExplanation.tsx';

/** French texts of the panel. */
const STRINGS = STRINGS_FR.explain.spare;

/** Letters of "Je suis calme" once normalised. */
const JE_SUIS_CALME = ['J', 'E', 'S', 'U', 'I', 'S', 'C', 'A', 'L', 'M', 'E'];

/**
 * Builds a Spare sigil and fails the test if the builder refused.
 *
 * @param letters - Normalised letters.
 * @param keepVowels - Vowel option.
 * @returns The sigil.
 */
function spare(letters: readonly string[], keepVowels = false): Sigil {
  const result = buildSpareSigil(letters, { keepVowels, variant: 0 });
  if (!result.ok) throw new Error(`Unexpected Spare error ${result.error.code}`);
  return result.data;
}

/**
 * Replaces the placements of a sigil, to test the wording of given transforms.
 *
 * @param sigil - Spare sigil.
 * @param letters - Placements to put in its `spare-letter-placements` step.
 * @returns A copy of the sigil.
 */
function withPlacements(sigil: Sigil, letters: SpareLetterPlacement[]): Sigil {
  return {
    ...sigil,
    steps: sigil.steps.map((step) =>
      step.kind === 'spare-letter-placements' ? { ...step, letters } : step,
    ),
  };
}

describe('SpareExplanation', () => {
  it('lists the four steps in order', () => {
    render(<SpareExplanation sigil={spare(JE_SUIS_CALME)} strings={STRINGS} />);

    const titles = screen.getAllByRole('heading', { level: 3 }).map((title) => title.textContent);
    expect(titles).toEqual([
      'Lettres retirées',
      'Squelettes des lettres',
      'Composition retenue',
      'Simplification',
    ]);
  });

  it('strikes the removed letters and says why, then lists the retained ones (F2)', () => {
    const { container } = render(
      <SpareExplanation sigil={spare(JE_SUIS_CALME)} strings={STRINGS} />,
    );

    const strip = screen.getByRole('list', { name: 'Les 11 lettres de l’intention' });
    const letters = within(strip).getAllByRole('listitem');
    expect(letters[0]).toHaveTextContent('J, gardée');
    expect(letters[0]).not.toHaveClass('is-removed');
    expect(letters[10]).toHaveTextContent('E, retirée : doublon');
    expect(letters[10]).toHaveClass('is-removed');
    const rows = Array.from(container.querySelectorAll('.spare-removal__row'), (row) =>
      row.textContent.trim(),
    );
    expect(rows).toEqual(['DoublonsS E', 'VoyellesE U I A', 'RetenuesJ S C L M']);
  });

  it('draws one tile per retained letter and the letters laid on top of each other', () => {
    const sigil = spare(JE_SUIS_CALME);
    render(<SpareExplanation sigil={sigil} strings={STRINGS} />);

    const tiles = screen.getByRole('list', {
      name: 'Lettres retenues et transformation de chacune',
    });
    expect(within(tiles).getAllByRole('listitem')).toHaveLength(5);
    const superimposed = screen.getByRole('img', {
      name: 'Les 5 lettres superposées avant fusion',
    });
    const placements = sigil.steps.find((step) => step.kind === 'spare-letter-placements');
    const strokeCount =
      placements?.kind === 'spare-letter-placements'
        ? placements.letters.reduce((total, letter) => total + letter.strokes.length, 0)
        : 0;
    expect(superimposed.querySelectorAll('path')).toHaveLength(strokeCount);
  });

  it('words each transform: mirror, turn, size and shared stem', () => {
    const sigil = spare(['J', 'S']);
    const placements = sigil.steps.find((step) => step.kind === 'spare-letter-placements');
    if (placements?.kind !== 'spare-letter-placements') throw new Error('No placements step.');
    const [first, second] = placements.letters;
    if (first === undefined || second === undefined) throw new Error('Two placements expected.');

    render(
      <SpareExplanation
        sigil={withPlacements(sigil, [
          { ...first, mirrored: false, rotation: 0, scale: 1, sharedStemWith: null },
          { ...second, mirrored: true, rotation: 270, scale: 0.8, sharedStemWith: 0 },
        ])}
        strings={STRINGS}
      />,
    );

    const tiles = within(
      screen.getByRole('list', { name: 'Lettres retenues et transformation de chacune' }),
    ).getAllByRole('listitem');
    expect(tiles[0]).toHaveTextContent(/^Jdroite$/);
    expect(tiles[1]).toHaveTextContent('Smiroir · ¾ de tour · 80 % · barre de J');
  });

  it('names the chosen composition among the candidates, in one sentence', () => {
    const sigil = spare(JE_SUIS_CALME);
    const choice = sigil.steps.find((step) => step.kind === 'spare-candidate-choice');
    if (choice?.kind !== 'spare-candidate-choice') throw new Error('No choice step.');
    render(<SpareExplanation sigil={sigil} strings={STRINGS} />);

    expect(
      screen.getByText(
        new RegExp(
          `^Parmi ${String(choice.candidateCount)} façons.*la n°\\s${String(choice.chosenIndex + 1)} est la plus équilibrée`,
        ),
      ),
    ).toBeInTheDocument();
  });

  it.each([
    [48, 31, /partie commune n’est tracée qu’une fois : 48 segments deviennent 31\./],
    [51, 51, /; le sigil compte toujours 51 segments\./],
    [52, 53, /Un trait recouvert en partie est coupé .* on passe de 52 à 53 segments\./],
  ])('counts the segments before and after the merge (%i → %i)', (before, after, expected) => {
    const sigil = spare(JE_SUIS_CALME);
    const merged = {
      ...sigil,
      steps: sigil.steps.map((step) =>
        step.kind === 'spare-simplification'
          ? { ...step, segmentCountBefore: before, segmentCountAfter: after }
          : step,
      ),
    };
    render(<SpareExplanation sigil={merged} strings={STRINGS} />);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('drops the vowel line when the vowels are kept', () => {
    render(<SpareExplanation sigil={spare(JE_SUIS_CALME, true)} strings={STRINGS} />);

    expect(screen.queryByText('Voyelles')).not.toBeInTheDocument();
    expect(screen.getByText('J E S U I C A L M')).toBeInTheDocument();
    expect(screen.getByText(/Les voyelles sont gardées/)).toBeInTheDocument();
  });

  it('renders nothing for a sigil without Spare steps', () => {
    const sigil = { ...spare(JE_SUIS_CALME), steps: [] };
    const { container } = render(<SpareExplanation sigil={sigil} strings={STRINGS} />);

    expect(container).toBeEmptyDOMElement();
  });
});
