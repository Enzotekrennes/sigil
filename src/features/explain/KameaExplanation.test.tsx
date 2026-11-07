/**
 * Component tests of the kamea explanation panel: the four steps, the worked
 * example of the rule, the table, the square with the path and the loops.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { STRINGS_FR } from '../../app/strings.fr.ts';
import { buildKameaSigil } from '../kamea/index.ts';
import { polylinePathData } from '../sigil/index.ts';
import type { Planet, Sigil } from '../sigil/types.ts';
import { KameaExplanation } from './KameaExplanation.tsx';

/** French texts of the panel. */
const STRINGS = STRINGS_FR.explain.kamea;

/**
 * Builds a kamea sigil and fails the test if the builder refused.
 *
 * @param letters - Normalised letters.
 * @param planet - Square to use.
 * @returns The sigil.
 */
function kamea(letters: readonly string[], planet: Planet): Sigil {
  const result = buildKameaSigil(letters, planet);
  if (!result.ok) throw new Error(`Unexpected kamea error ${result.error.code}`);
  return result.data;
}

describe('KameaExplanation', () => {
  it('lists the four steps in order', () => {
    render(<KameaExplanation sigil={kamea(['J', 'E'], 'saturn')} strings={STRINGS} />);

    const titles = screen.getAllByRole('heading', { level: 3 }).map((title) => title.textContent);
    expect(titles).toEqual([
      'Lettres tracées',
      'Règle de conversion',
      'Lettre → nombre',
      'Chemin sur le carré',
    ]);
  });

  it('draws the square with every number and the sigil path', () => {
    const sigil = kamea(['J', 'E', 'S'], 'jupiter');
    render(<KameaExplanation sigil={sigil} strings={STRINGS} />);

    const grid = screen.getByRole('img', { name: /^Carré de Jupiter, 4 × 4/ });
    expect(grid.querySelectorAll('text')).toHaveLength(16);
    const path = grid.querySelector('.kamea-grid__path path');
    expect(path?.getAttribute('d')).toBe(polylinePathData(sigil.strokes[0] ?? []));
    expect(grid.querySelector('[data-mark="start-circle"]')).not.toBeNull();
    expect(grid.querySelector('[data-mark="end-bar"]')).not.toBeNull();
  });

  it('sets every number on a plate of its cell colour, drawn after the path', () => {
    const sigil = kamea(['J', 'E', 'S', 'U', 'I', 'S', 'C', 'A', 'L', 'M', 'E'], 'saturn');
    render(<KameaExplanation sigil={sigil} strings={STRINGS} />);

    const grid = screen.getByRole('img', { name: /^Carré de Saturne/ });
    const plates = grid.querySelectorAll('.kamea-grid__plate');
    expect(plates).toHaveLength(9);
    // Cells 1, 5, 3, 9 and 4 are visited: their plates take the active cell colour.
    expect(grid.querySelectorAll('.kamea-grid__plate--visited')).toHaveLength(5);
    const path = grid.querySelector('.kamea-grid__path');
    const numbers = grid.querySelector('.kamea-grid__numbers');
    if (path === null || numbers === null) throw new Error('Path or numbers missing');
    // Painted later means on top: the path passes under the numbers.
    expect(path.compareDocumentPosition(numbers) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const plate of plates) {
      const text = plate.nextElementSibling;
      expect(text?.tagName.toLowerCase()).toBe('text');
      // The plate starts before its number, so it covers the path under the digits.
      expect(Number(plate.getAttribute('x'))).toBeLessThan(Number(text?.getAttribute('x')));
      expect(Number(plate.getAttribute('y'))).toBeLessThan(Number(text?.getAttribute('y')));
    }
  });

  it('counts the loops when a number repeats', () => {
    // A and J both give 1 on Saturn: one loop.
    render(<KameaExplanation sigil={kamea(['A', 'J', 'B'], 'saturn')} strings={STRINGS} />);

    expect(screen.getByText(/Une boucle marque une case/)).toBeInTheDocument();
    expect(screen.getAllByRole('img')[0]?.querySelectorAll('[data-mark="loop"]')).toHaveLength(1);
  });

  it('says that large squares keep the letter rank', () => {
    render(<KameaExplanation sigil={kamea(['J', 'E'], 'sun')} strings={STRINGS} />);

    expect(screen.getByText(/36 cases, plus que les 26 lettres/)).toBeInTheDocument();
    expect(screen.queryByText(/réduction pythagoricienne/)).not.toBeInTheDocument();
  });

  it('reads each table entry in full for screen readers', () => {
    render(<KameaExplanation sigil={kamea(['Z', 'B'], 'mars')} strings={STRINGS} />);

    const table = screen.getByRole('list', { name: 'Table lettre, rang, case' });
    expect(within(table).getByText('Z : rang 26, case 1')).toBeInTheDocument();
    expect(
      screen.getByText('Exemple : Z, rang 26 → ((26 − 1) mod 25) + 1 = 1'),
    ).toBeInTheDocument();
  });

  it('renders nothing for a sigil without kamea steps', () => {
    const sigil = { ...kamea(['J', 'E'], 'saturn'), steps: [] };
    const { container } = render(<KameaExplanation sigil={sigil} strings={STRINGS} />);

    expect(container).toBeEmptyDOMElement();
  });
});
