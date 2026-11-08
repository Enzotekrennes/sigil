/**
 * Component tests of the Spare explanation panel: the five steps, the letter
 * strip with the reason of each removal, the angular skeleton of each letter
 * over its Hershey letter, the stem and how each letter hooks onto it, the
 * variant's style and the rune chosen, and the merge counts; the letters
 * kept out of a browser's page translation.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { STRINGS_EN } from '../../app/strings.en.ts';
import { STRINGS_FR } from '../../app/strings.fr.ts';
import { polylinePathData } from '../sigil/index.ts';
import type {
  Sigil,
  SpareAngularSkeletonsStep,
  SpareCandidateChoiceStep,
  SpareStemAttachment,
  SpareStemAttachmentsStep,
} from '../sigil/types.ts';
import { buildSpareSigil } from '../spare/index.ts';
import { SpareExplanation } from './SpareExplanation.tsx';

/** French texts of the panel. */
const STRINGS = STRINGS_FR.explain.spare;

/** Letters of "Jesuiscalme" once normalised: duplicates S E, vowels E U I A, kept J S C L M. */
const JE_SUIS_CALME = ['J', 'E', 'S', 'U', 'I', 'S', 'C', 'A', 'L', 'M', 'E'];

/** Accessible name of the list of hooked letters. */
const HOOKED_LIST = 'Lettres accrochées, de haut en bas';

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
 * The angular skeletons step of a Spare sigil.
 *
 * @param sigil - Spare sigil.
 * @returns Its `spare-angular-skeletons` step; fails the test when missing.
 */
function skeletonsOf(sigil: Sigil): SpareAngularSkeletonsStep {
  const step = sigil.steps.find((candidate) => candidate.kind === 'spare-angular-skeletons');
  if (step?.kind !== 'spare-angular-skeletons') throw new Error('No skeletons step.');
  return step;
}

/**
 * The attachments step of a Spare sigil.
 *
 * @param sigil - Spare sigil.
 * @returns Its `spare-stem-attachments` step; fails the test when missing.
 */
function attachmentsOf(sigil: Sigil): SpareStemAttachmentsStep {
  const step = sigil.steps.find((candidate) => candidate.kind === 'spare-stem-attachments');
  if (step?.kind !== 'spare-stem-attachments') throw new Error('No attachments step.');
  return step;
}

/**
 * Replaces the attachments of a sigil, to test the wording of given ones.
 *
 * @param sigil - Spare sigil.
 * @param order - Letters from the top of the stem down.
 * @param letters - Attachments to put in its `spare-stem-attachments` step.
 * @returns A copy of the sigil.
 */
function withAttachments(
  sigil: Sigil,
  order: readonly string[],
  letters: readonly SpareStemAttachment[],
): Sigil {
  return {
    ...sigil,
    steps: sigil.steps.map((step) =>
      step.kind === 'spare-stem-attachments' ? { ...step, order, letters } : step,
    ),
  };
}

/**
 * Replaces the style of the variant of a sigil.
 *
 * @param sigil - Spare sigil.
 * @param style - Style to put in its `spare-candidate-choice` step.
 * @returns A copy of the sigil.
 */
function withStyle(sigil: Sigil, style: SpareCandidateChoiceStep['style']): Sigil {
  return {
    ...sigil,
    steps: sigil.steps.map((step) =>
      step.kind === 'spare-candidate-choice' ? { ...step, style } : step,
    ),
  };
}

describe('SpareExplanation', () => {
  it('lists the five steps in order', () => {
    render(<SpareExplanation sigil={spare(JE_SUIS_CALME)} strings={STRINGS} />);

    const titles = screen.getAllByRole('heading', { level: 3 }).map((title) => title.textContent);
    expect(titles).toEqual([
      'Lettres retirées',
      'Squelettes anguleux',
      'Accroche sur la hampe',
      'Choix de la variante',
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
    expect(rows).toEqual(['Doublons :S E', 'Voyelles :E U I A', 'Retenues :J S C L M']);
  });

  it('keeps the intention letters out of page translation, but not the "none" word (S8)', () => {
    const { container } = render(
      <SpareExplanation sigil={spare(['J', 'S', 'C'])} strings={STRINGS} />,
    );

    const strip = screen.getByRole('list', { name: 'Les 3 lettres de l’intention' });
    for (const item of within(strip).getAllByRole('listitem')) {
      expect(item.querySelector('[translate="no"]')?.textContent).toMatch(/^[A-Z]$/);
    }
    const lines = Array.from(container.querySelectorAll('.spare-removal dd'));
    // No duplicate and no vowel: "aucune" stays translatable; the retained letters do not.
    expect(lines.map((line) => line.getAttribute('translate'))).toEqual([null, null, 'no']);
    expect(lines[2]).toHaveTextContent('J S C');
    const tileLetters = Array.from(container.querySelectorAll('.glyph-tile__letter'));
    const hookedLetters = Array.from(container.querySelectorAll('.spare-attachments__name'));
    expect(tileLetters).toHaveLength(3);
    expect(hookedLetters).toHaveLength(3);
    for (const letter of [...tileLetters, ...hookedLetters]) {
      expect(letter).toHaveAttribute('translate', 'no');
    }
  });

  it('writes the colon of the removal labels the English way, with no space before it', () => {
    const { container } = render(
      <SpareExplanation sigil={spare(JE_SUIS_CALME)} strings={STRINGS_EN.explain.spare} />,
    );

    const labels = Array.from(
      container.querySelectorAll('.spare-removal dt'),
      (label) => label.textContent,
    );
    expect(labels).toEqual(['Duplicates:', 'Vowels:', 'Kept:']);
    expect(container.textContent).not.toMatch(/\s:/);
  });

  it('marks the removed letters lines as not to translate when they list letters (S8)', () => {
    const { container } = render(
      <SpareExplanation sigil={spare(JE_SUIS_CALME)} strings={STRINGS} />,
    );

    const lines = Array.from(container.querySelectorAll('.spare-removal dd'));
    expect(lines.map((line) => line.getAttribute('translate'))).toEqual(['no', 'no', 'no']);
  });

  it('draws each retained letter faint under its bold angular skeleton, with its segment count (D20)', () => {
    const sigil = spare(JE_SUIS_CALME);
    render(<SpareExplanation sigil={sigil} strings={STRINGS} />);

    const tiles = within(
      screen.getByRole('list', { name: 'Squelettes anguleux des lettres retenues' }),
    ).getAllByRole('listitem');
    const skeletons = skeletonsOf(sigil).letters;
    expect(tiles).toHaveLength(5);
    for (const [index, skeleton] of skeletons.entries()) {
      const tile = tiles[index];
      if (tile === undefined) throw new Error(`No tile for ${skeleton.letter}.`);
      expect(tile).toHaveTextContent(
        new RegExp(`^${skeleton.letter}${String(skeleton.segmentCount)} segments?$`),
      );
      expect(tile.querySelectorAll('.stroke-drawing__context path')).toHaveLength(
        skeleton.glyph.length,
      );
      expect(tile.querySelectorAll('g:not(.stroke-drawing__context) path')).toHaveLength(
        skeleton.angular.length,
      );
    }
    // The reference board of the angular letters: C in 2 segments, M in 4.
    expect(tiles[2]).toHaveTextContent(/^C2 segments$/);
    expect(tiles[4]).toHaveTextContent(/^M4 segments$/);
  });

  it('draws the rune before merging, the stem in bold over the hooked letters (D19)', () => {
    const sigil = spare(JE_SUIS_CALME);
    render(<SpareExplanation sigil={sigil} strings={STRINGS} />);

    const step = attachmentsOf(sigil);
    const rune = screen.getByRole('img', {
      name: 'La hampe en trait appuyé et les 5 lettres accrochées, avant fusion',
    });
    const stem = rune.querySelectorAll('g:not(.stroke-drawing__context) path');
    expect(stem).toHaveLength(1);
    expect(stem[0]).toHaveAttribute('d', polylinePathData([step.stem.top, step.stem.bottom]));
    const letterStrokes = step.letters.reduce((total, letter) => total + letter.strokes.length, 0);
    expect(rune.querySelectorAll('.stroke-drawing__context path')).toHaveLength(letterStrokes);
    expect(screen.getByText('Hampe en trait appuyé')).toBeInTheDocument();
  });

  it('names the drawing of a single hooked letter in the singular', () => {
    render(<SpareExplanation sigil={spare(['M'])} strings={STRINGS} />);

    expect(
      screen.getByRole('img', {
        name: 'La hampe en trait appuyé et la lettre accrochée, avant fusion',
      }),
    ).toBeInTheDocument();
  });

  it('lists the hooked letters from the top of the stem down', () => {
    const sigil = spare(JE_SUIS_CALME);
    render(<SpareExplanation sigil={sigil} strings={STRINGS} />);

    const items = within(screen.getByRole('list', { name: HOOKED_LIST })).getAllByRole('listitem');
    expect(items.map((item) => item.querySelector('[translate="no"]')?.textContent)).toEqual(
      attachmentsOf(sigil).order,
    );
  });

  it('words how each letter hooks onto the stem: way, mirror, double and side, nothing that shows no change', () => {
    const sigil = spare(['M', 'R', 'S', 'T', 'G']);
    const [first] = attachmentsOf(sigil).letters;
    if (first === undefined) throw new Error('An attachment expected.');

    render(
      <SpareExplanation
        sigil={withAttachments(
          sigil,
          ['G', 'M', 'R', 'S', 'T'],
          [
            {
              ...first,
              letter: 'M',
              attachment: 'stem',
              mirrored: true,
              doubled: true,
              side: 'both',
            },
            {
              ...first,
              letter: 'R',
              attachment: 'stem',
              mirrored: true,
              doubled: false,
              side: 'left',
            },
            {
              ...first,
              letter: 'S',
              attachment: 'centre',
              mirrored: true,
              doubled: false,
              side: 'both',
            },
            {
              ...first,
              letter: 'T',
              attachment: 'stem',
              mirrored: true, // T is symmetric about its stem: the mirror is not said.
              doubled: false,
              side: 'both',
            },
            {
              ...first,
              letter: 'G',
              attachment: 'tip',
              mirrored: false,
              doubled: false,
              side: 'right',
            },
          ],
        )}
        strings={STRINGS}
      />,
    );

    const items = within(screen.getByRole('list', { name: HOOKED_LIST })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Gsuspendue · à droite',
      'Msur la hampe · doublée en symétrie',
      'Rsur la hampe · en miroir · à gauche',
      'Scentrée · en miroir',
      'Tsur la hampe · des deux côtés',
    ]);
  });

  it.each([
    ['symmetric', /^Cette variante est symétrique : chaque lettre posée d’un seul côté/],
    ['paired', /^Cette variante est appariée : aucune lettre n’est doublée/],
    ['mixed', /^Cette variante est mixte : certaines lettres sont doublées/],
  ] as const)('says the %s style of the variant in one sentence', (style, expected) => {
    render(<SpareExplanation sigil={withStyle(spare(JE_SUIS_CALME), style)} strings={STRINGS} />);

    const sentence = screen.getByText(expected);
    expect(sentence.textContent.match(/[.!?]/g)).toHaveLength(1);
  });

  it('names the chosen rune among the candidates, with the criteria of the score (D21)', () => {
    const sigil = spare(JE_SUIS_CALME);
    const choice = sigil.steps.find((step) => step.kind === 'spare-candidate-choice');
    if (choice?.kind !== 'spare-candidate-choice') throw new Error('No choice step.');
    render(<SpareExplanation sigil={sigil} strings={STRINGS} />);

    const sentence = screen.getByText(
      new RegExp(
        `^Parmi ${String(choice.candidateCount)} runes tirées.*la n°\\s${String(choice.chosenIndex + 1)} est retenue`,
      ),
    );
    expect(sentence).toHaveTextContent(/sans traits parallèles collés, plus haute que large/);
    expect(sentence).toHaveTextContent(/équilibrée de part et d’autre de la hampe\.$/);
  });

  it('uses none of the words of the former free composition', () => {
    const { container } = render(
      <SpareExplanation sigil={spare(JE_SUIS_CALME)} strings={STRINGS} />,
    );

    expect(container).not.toHaveTextContent(
      /superpos|fondu|lisib|centre de gravité|recentré|composition|transformation/i,
    );
  });

  it.each([
    [48, 31, /partie commune n’est tracée qu’une fois, et 48 segments deviennent 31\.$/],
    [51, 51, /; le sigil compte toujours 51 segments\.$/],
    [52, 53, /Un trait recouvert en partie est coupé .* on passe de 52 à 53 segments\.$/],
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

    expect(screen.getByText(/^La hampe et les lettres partagent des traits/)).toHaveTextContent(
      expected,
    );
  });

  it('drops the vowel line when the vowels are kept', () => {
    render(<SpareExplanation sigil={spare(JE_SUIS_CALME, true)} strings={STRINGS} />);

    expect(screen.queryByText(/^Voyelles/)).not.toBeInTheDocument();
    expect(screen.getByText('J E S U I C A L M')).toBeInTheDocument();
    expect(screen.getByText(/Les voyelles sont gardées/)).toBeInTheDocument();
  });

  it('renders nothing for a sigil without Spare steps', () => {
    const sigil = { ...spare(JE_SUIS_CALME), steps: [] };
    const { container } = render(<SpareExplanation sigil={sigil} strings={STRINGS} />);

    expect(container).toBeEmptyDOMElement();
  });
});
