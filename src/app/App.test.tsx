/**
 * Component tests of the main screen, through what a user sees and does:
 * empty state, tracing a kamea sigil, the explanation panel, business errors
 * under the field, replay, and the privacy guarantees (decision D8).
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './App.tsx';

/** Intention of the F1 scenario. */
const INTENTION = 'Je suis calme';

/**
 * Types an intention in the field.
 *
 * @param text - Text to type.
 */
function typeIntention(text: string): void {
  fireEvent.change(screen.getByLabelText('Intention'), { target: { value: text } });
}

/** Presses the "Tracer" button. */
function clickTrace(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Tracer' }));
}

/**
 * Run key of the tracing animation currently shown.
 *
 * @returns The `data-run` attribute of the sigil's ink group.
 */
function currentRun(): string | null {
  const ink = screen.getByRole('img', { name: /^Sigil kamea/ }).querySelector('[data-run]');
  return ink?.getAttribute('data-run') ?? null;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('App', () => {
  it('renders the page title as the only level-one heading', () => {
    render(<App />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sigil');
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('starts empty with an invitation and the replay button disabled', () => {
    render(<App />);

    expect(screen.getByText(/Écrivez une intention, choisissez un carré/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /^Sigil kamea/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rejouer' })).toBeDisabled();
  });

  it('shows Spare as unavailable and kamea selected', () => {
    render(<App />);

    expect(screen.getByRole('radio', { name: /Spare/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Spare/ })).toHaveAccessibleName('Spare bientôt');
    expect(screen.getByRole('radio', { name: 'Kamea' })).toBeChecked();
  });

  it('offers the seven planets with the size of their square', () => {
    render(<App />);

    const group = screen.getByRole('group', { name: 'Carré planétaire' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(7);
    expect(within(group).getByRole('radio', { name: 'Saturne 3×3' })).toBeChecked();
    expect(within(group).getByRole('radio', { name: 'Lune 9×9' })).not.toBeChecked();
  });

  it('counts the letters to trace while typing', () => {
    render(<App />);

    typeIntention('Je suis calme !');

    expect(screen.getByText('11 lettres à tracer')).toBeInTheDocument();
  });

  it('traces the sigil with a generic accessible name that does not contain the intention', () => {
    render(<App />);

    typeIntention(INTENTION);
    clickTrace();

    const sigil = screen.getByRole('img', { name: 'Sigil kamea de Saturne' });
    expect(sigil.outerHTML.toLowerCase()).not.toContain('calme');
    expect(screen.getByRole('button', { name: 'Rejouer' })).toBeEnabled();
    expect(
      screen.getByText('Sigil tracé : 11 lettres sur le carré de Saturne.'),
    ).toBeInTheDocument();
  });

  it('traces when Enter is pressed in the field, without leaving the page', () => {
    render(<App />);
    const before = window.location.href;

    typeIntention(INTENTION);
    fireEvent.submit(screen.getByLabelText('Intention'));

    expect(screen.getByRole('img', { name: 'Sigil kamea de Saturne' })).toBeInTheDocument();
    expect(window.location.href).toBe(before);
  });

  it('opens the explanation with the rule, the table and the path on the square (F1)', () => {
    render(<App />);

    typeIntention(INTENTION);
    clickTrace();

    const panel = screen.getByRole('heading', { name: 'Comment c’est fait' }).closest('details');
    expect(panel).toHaveAttribute('open');
    if (panel === null) return;
    const explanation = within(panel);
    expect(explanation.getByText('nombre = ((rang − 1) mod 9) + 1')).toBeInTheDocument();
    expect(
      explanation.getByText('Exemple : J, rang 10 → ((10 − 1) mod 9) + 1 = 1'),
    ).toBeInTheDocument();
    expect(explanation.getByText(/réduction pythagoricienne/)).toBeInTheDocument();
    const table = explanation.getByRole('list', { name: 'Table lettre, rang, case' });
    expect(within(table).getAllByRole('listitem')).toHaveLength(11);
    expect(within(table).getByText('U : rang 21, case 3')).toBeInTheDocument();
    expect(
      explanation.getByRole('img', {
        name: 'Carré de Saturne, 3 × 3, avec le chemin : 1, 5, 1, 3, 9, 1, 3, 1, 3, 4, 5',
      }),
    ).toBeInTheDocument();
  });

  it('draws on the chosen planet', () => {
    render(<App />);

    typeIntention(INTENTION);
    fireEvent.click(screen.getByRole('radio', { name: 'Lune 9×9' }));
    clickTrace();

    expect(screen.getByRole('img', { name: 'Sigil kamea de la Lune' })).toBeInTheDocument();
    expect(
      screen.getByText(/Le carré compte 81 cases, plus que les 26 lettres/),
    ).toBeInTheDocument();
  });

  it('signals the characters it ignored', () => {
    render(<App />);

    typeIntention('Calme 2026');
    clickTrace();

    // Testing Library folds the no-break spaces inside the guillemets into plain spaces.
    const warnings = screen
      .getAllByRole('status')
      .filter((status) => status.textContent.startsWith('Caractères ignorés'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toHaveTextContent(
      'Caractères ignorés : « 2 » « 0 » « 6 ». Seules les lettres A à Z sont tracées.',
    );
  });

  it('shows an error under the field and draws nothing for an empty intention', () => {
    render(<App />);

    clickTrace();

    const field = screen.getByLabelText('Intention');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(/Écrivez une intention avant de tracer/);
    expect(field).toHaveFocus();
    expect(screen.queryByRole('img', { name: /^Sigil kamea/ })).not.toBeInTheDocument();
  });

  it('shows an error and draws nothing for an intention without Latin letters (F1)', () => {
    render(<App />);

    typeIntention('123 !');
    clickTrace();

    expect(screen.getByLabelText('Intention')).toHaveAccessibleDescription(
      /Aucune lettre latine à tracer/,
    );
    expect(screen.queryByRole('img', { name: /^Sigil kamea/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Rien à tracer : corrigez l’intention/)).toBeInTheDocument();
  });

  it('explains when every letter falls on the same cell', () => {
    render(<App />);

    typeIntention('aj');
    clickTrace();

    expect(screen.getByLabelText('Intention')).toHaveAccessibleDescription(
      /Toutes les lettres tombent sur la case 1 du carré de Saturne/,
    );
  });

  it('clears the error as soon as the intention changes', () => {
    render(<App />);
    clickTrace();

    typeIntention('J');

    expect(screen.getByLabelText('Intention')).toHaveAttribute('aria-invalid', 'false');
  });

  it('keeps the same tracing run while typing after a trace, and replays on demand', () => {
    render(<App />);
    typeIntention(INTENTION);
    clickTrace();
    const firstRun = currentRun();

    typeIntention('Je suis calme et serein');
    expect(currentRun()).toBe(firstRun);

    fireEvent.click(screen.getByRole('button', { name: 'Rejouer' }));
    expect(currentRun()).not.toBe(firstRun);
  });

  it('never writes the intention in the URL or in browser storage (D8)', () => {
    render(<App />);
    const before = window.location.href;

    typeIntention(INTENTION);
    clickTrace();

    expect(window.location.href).toBe(before);
    expect(window.location.href.toLowerCase()).not.toContain('calme');
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
  });
});
