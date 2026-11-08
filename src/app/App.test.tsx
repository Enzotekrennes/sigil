/**
 * Component tests of the main screen, through what a user sees and does:
 * empty state, tracing a kamea or a Spare sigil, Spare variants and vowel
 * option, the explanation panels, business errors under the field, replay
 * (animated, or step by step under reduced motion), the style settings and
 * the tattoo stencil mode, the kamea note of the export dialog, the privacy
 * note of the footer, and the privacy guarantees (decision D8). The browser is set to French; the
 * language switch has its own tests in `App.i18n.test.tsx`.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubNativeDialog } from '../test/dialogStub.ts';
import { candidateCountFor } from '../features/spare/index.ts';
import { App } from './App.tsx';

/** Intention of the F1 scenario: one word (D18), C A L M E. */
const INTENTION = 'Calme';

/**
 * Intention of the Spare scenarios: one word whose reduction removes both
 * duplicates (L I T) and vowels (A U I E), and keeps T R N Q L.
 */
const SPARE_INTENTION = 'Tranquillité';

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
 * @param name - Accessible name of the sigil shown.
 * @returns The `data-run` attribute of the sigil's ink group.
 */
function currentRun(name = /^Sigil kamea/): string | null {
  const ink = screen.getByRole('img', { name }).querySelector('[data-run]');
  return ink?.getAttribute('data-run') ?? null;
}

/** Selects the Spare method. */
function chooseSpare(): void {
  fireEvent.click(screen.getByRole('radio', { name: 'Spare' }));
}

/**
 * Path data of the Spare sigil shown, one entry per stroke.
 *
 * @returns The `d` attribute of every path of the sigil.
 */
function spareStrokes(): (string | null)[] {
  const sigil = screen.getByRole('img', { name: /^Sigil de Spare/ });
  return Array.from(sigil.querySelectorAll('path'), (path) => path.getAttribute('d'));
}

/**
 * The open "how it is made" panel.
 *
 * @returns Queries bound to the panel.
 */
function explanationPanel() {
  const panel = screen.getByRole('heading', { name: 'Comment c’est fait' }).closest('details');
  if (panel === null) throw new Error('No explanation panel.');
  return within(panel);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // jsdom reports an English browser; these tests read the French interface.
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR']);
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Replaces `window.matchMedia` so that only the reduced motion query matches.
 *
 * @param reduced - Whether the user prefers reduced motion.
 */
function mockReducedMotion(reduced: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduced && query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/**
 * The kamea sigil shown.
 *
 * @returns Its `<svg>` element.
 */
function kameaSigil(): HTMLElement {
  return screen.getByRole('img', { name: /^Sigil kamea/ });
}

/**
 * The ink group of the kamea sigil shown, which carries the stroke settings.
 *
 * @returns The `.sigil-renderer__ink` element.
 */
function kameaInk(): Element {
  const ink = kameaSigil().querySelector('[data-run]');
  if (ink === null) throw new Error('No sigil ink.');
  return ink;
}

/**
 * Path data of the kamea sigil shown.
 *
 * @returns The `d` attribute of its path.
 */
function kameaPath(): string {
  return kameaSigil().querySelector('path')?.getAttribute('d') ?? '';
}

/**
 * Number of segments of the kamea path shown.
 *
 * @returns The count of `L` commands of the path.
 */
function kameaSegments(): number {
  return kameaPath().match(/L/g)?.length ?? 0;
}

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

  it('offers both methods, kamea selected', () => {
    render(<App />);

    expect(screen.getByRole('radio', { name: 'Spare' })).toBeEnabled();
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

  it('counts the letters to trace while typing, apostrophe left out', () => {
    render(<App />);

    typeIntention('Aujourd’hui');

    expect(screen.getByText('10 lettres à tracer')).toBeInTheDocument();
  });

  it('asks for a single word of 24 letters at most in the help of the field (D18)', () => {
    render(<App />);

    expect(screen.getByLabelText('Intention')).toHaveAccessibleDescription(
      /^Un seul mot, de 24 lettres au plus\./,
    );
  });

  it('signals in the counter a word longer than 24 letters (D18)', () => {
    render(<App />);

    typeIntention('Anticonstitutionnellement');

    expect(screen.getByText('25 lettres : 1 de trop, 24 au plus')).toBeInTheDocument();
  });

  it('traces the sigil with a generic accessible name that does not contain the intention', () => {
    render(<App />);

    typeIntention(INTENTION);
    clickTrace();

    const sigil = screen.getByRole('img', { name: 'Sigil kamea de Saturne' });
    expect(sigil.outerHTML.toLowerCase()).not.toContain('calme');
    expect(screen.getByRole('button', { name: 'Rejouer' })).toBeEnabled();
    expect(
      screen.getByText('Sigil tracé : 5 lettres sur le carré de Saturne.'),
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
      explanation.getByText('Exemple : L, rang 12 → ((12 − 1) mod 9) + 1 = 3'),
    ).toBeInTheDocument();
    expect(explanation.getByText(/réduction pythagoricienne/)).toBeInTheDocument();
    const table = explanation.getByRole('list', { name: 'Table lettre, rang, case' });
    expect(within(table).getAllByRole('listitem')).toHaveLength(5);
    expect(within(table).getByText('M : rang 13, case 4')).toBeInTheDocument();
    expect(
      explanation.getByRole('img', {
        name: 'Carré de Saturne, 3 × 3, avec le chemin : 3, 1, 3, 4, 5',
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

    typeIntention('Calme2026');
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

  it('asks for a single word and draws nothing for a sentence, focus on the field (D18)', () => {
    render(<App />);

    typeIntention('Je suis calme');
    clickTrace();

    const field = screen.getByLabelText('Intention');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveFocus();
    expect(field).toHaveAccessibleDescription(
      /Un seul mot, sans espace : au-delà d’un mot, le sigil devient illisible\./,
    );
    expect(screen.queryByRole('img', { name: /^Sigil kamea/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Rien à tracer : corrigez l’intention/)).toBeInTheDocument();

    chooseSpare();
    clickTrace();
    expect(field).toHaveAccessibleDescription(/Un seul mot, sans espace/);
    expect(screen.queryByRole('img', { name: /^Sigil de Spare/ })).not.toBeInTheDocument();
  });

  it('refuses a word longer than 24 letters, with its count (D18)', () => {
    render(<App />);

    typeIntention('Anticonstitutionnellement');
    clickTrace();

    const field = screen.getByLabelText('Intention');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(
      /Ce mot donne 25 lettres, 24 au plus : au-delà, le sigil devient illisible\./,
    );
    expect(screen.queryByRole('img', { name: /^Sigil kamea/ })).not.toBeInTheDocument();
  });

  it('traces a word with a hyphen as a single word (D18)', () => {
    render(<App />);

    typeIntention('Peut-être');
    clickTrace();

    expect(screen.getByRole('img', { name: 'Sigil kamea de Saturne' })).toBeInTheDocument();
    expect(screen.getByLabelText('Intention')).toHaveAttribute('aria-invalid', 'false');
  });

  it('agrees the verb with the number of characters it could not trace', () => {
    render(<App />);

    typeIntention('😀');
    clickTrace();
    expect(screen.getByLabelText('Intention')).toHaveAccessibleDescription(
      /«\s😀\s» ne se trace pas\./,
    );

    typeIntention('1 2');
    clickTrace();
    expect(screen.getByLabelText('Intention')).toHaveAccessibleDescription(
      /«\s1\s» «\s2\s» ne se tracent pas\./,
    );
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

    typeIntention('Sérénité');
    expect(currentRun()).toBe(firstRun);

    fireEvent.click(screen.getByRole('button', { name: 'Rejouer' }));
    expect(currentRun()).not.toBe(firstRun);
  });

  it('updates the stroke width, ends and framing circle without replaying the tracing (F3)', () => {
    render(<App />);
    typeIntention(INTENTION);
    clickTrace();
    const firstRun = currentRun();
    const shape = kameaPath();

    const width = screen.getByRole('slider', { name: 'Épaisseur' });
    expect(width).toHaveAttribute('aria-valuetext', '1,2, fin');
    fireEvent.change(width, { target: { value: '2.4' } });
    expect(width).toHaveAttribute('aria-valuetext', '2,4, épais');
    expect(kameaInk()).toHaveAttribute('stroke-width', '2.4');

    fireEvent.click(screen.getByRole('switch', { name: 'Extrémités arrondies' }));
    expect(kameaInk()).toHaveAttribute('stroke-linecap', 'butt');
    expect(kameaInk()).toHaveAttribute('stroke-linejoin', 'miter');
    // Width and ends never move a point of the path.
    expect(kameaPath()).toBe(shape);

    expect(kameaSigil().querySelector('.sigil-renderer__frame')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'Cercle d’encadrement' }));
    expect(kameaSigil().querySelector('.sigil-renderer__frame')).not.toBeNull();

    expect(currentRun()).toBe(firstRun);
  });

  it('keeps the style settings for the next sigil', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('slider', { name: 'Épaisseur' }), {
      target: { value: '2' },
    });

    typeIntention(INTENTION);
    clickTrace();

    expect(kameaInk()).toHaveAttribute('stroke-width', '2');
  });

  it('draws the tattoo stencil in pure black on white, without circle, its width in millimetres (F5)', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('switch', { name: 'Cercle d’encadrement' }));
    typeIntention(INTENTION);
    clickTrace();
    const shape = kameaPath();
    const firstRun = currentRun();

    fireEvent.click(screen.getByRole('switch', { name: 'Pochoir tatouage' }));

    expect(kameaSigil()).toHaveClass('sigil-renderer--stencil');
    expect(kameaSigil().closest('.sigil-stage')).toHaveClass('sigil-stage--stencil');
    expect(kameaSigil().querySelector('.sigil-renderer__frame')).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Cercle d’encadrement' })).toBeNull();
    const millimetres = screen.getByRole('slider', { name: 'Épaisseur' });
    expect(millimetres).toHaveValue('0.6');
    expect(millimetres).toHaveAttribute('aria-valuetext', '0,6 mm');
    expect(screen.getByRole('switch', { name: 'Pochoir tatouage' })).toHaveAccessibleDescription(
      expect.stringContaining('8 cm') as string,
    );
    const thin = Number(kameaInk().getAttribute('stroke-width'));

    fireEvent.change(millimetres, { target: { value: '1.2' } });
    const thick = Number(kameaInk().getAttribute('stroke-width'));
    expect(thick / thin).toBeGreaterThan(1.9);
    expect(thick / thin).toBeLessThan(2.1);
    expect(kameaPath()).toBe(shape);
    expect(currentRun()).toBe(firstRun);

    fireEvent.click(screen.getByRole('switch', { name: 'Pochoir tatouage' }));
    expect(kameaSigil()).toHaveClass('sigil-renderer--screen');
    expect(kameaInk()).toHaveAttribute('stroke-width', '1.2');
    expect(kameaSigil().querySelector('.sigil-renderer__frame')).not.toBeNull();
  });

  it('converts the stencil width for the print size set in the export dialog (F5)', () => {
    stubNativeDialog();
    render(<App />);
    typeIntention(INTENTION);
    clickTrace();
    fireEvent.click(screen.getByRole('switch', { name: 'Pochoir tatouage' }));
    const at8cm = Number(kameaInk().getAttribute('stroke-width'));

    fireEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    fireEvent.click(screen.getByRole('radio', { name: 'PDF' }));
    const size = screen.getByRole('textbox', { name: 'Taille réelle (cm)' });
    fireEvent.change(size, { target: { value: '16' } });
    const at16cm = Number(kameaInk().getAttribute('stroke-width'));
    expect(at16cm / at8cm).toBeGreaterThan(0.45);
    expect(at16cm / at8cm).toBeLessThan(0.55);

    // An invalid size keeps the last valid one for the drawing.
    fireEvent.change(size, { target: { value: '40' } });
    expect(Number(kameaInk().getAttribute('stroke-width'))).toBe(at16cm);
  });

  it('starts the style section folded on narrow screens', () => {
    render(<App />);

    const section = screen.getByRole('heading', { name: 'Style' }).closest('details');
    expect(section).not.toHaveAttribute('open');
  });

  it('replays step by step under reduced motion, one segment per press (F3)', () => {
    mockReducedMotion(true);
    render(<App />);
    typeIntention(INTENTION);
    clickTrace();
    const replay = screen.getByRole('button', { name: 'Rejouer' });
    const run = currentRun();

    expect(kameaSegments()).toBe(4);
    expect(replay).toHaveAccessibleDescription(/chaque clic sur « Rejouer » trace une étape/);

    fireEvent.click(replay);
    expect(kameaSegments()).toBe(1);
    expect(
      screen.getByText('Pas à pas : étape 1 sur 4.', { selector: '[role="status"]' }),
    ).toBeInTheDocument();

    fireEvent.click(replay);
    expect(kameaSegments()).toBe(2);
    expect(currentRun()).toBe(run);

    for (let step = 3; step <= 4; step += 1) fireEvent.click(replay);
    expect(kameaSegments()).toBe(4);
    expect(kameaSigil().querySelector('[data-mark="end-bar"]')).not.toBeNull();
    expect(
      screen.getByText(/étape 4 sur 4, sigil complet/, { selector: '[role="status"]' }),
    ).toBeInTheDocument();

    fireEvent.click(replay);
    expect(kameaSegments()).toBe(1);
  });

  it('shows a new sigil whole even in the middle of a step-by-step replay', () => {
    mockReducedMotion(true);
    render(<App />);
    typeIntention(INTENTION);
    clickTrace();
    fireEvent.click(screen.getByRole('button', { name: 'Rejouer' }));
    expect(kameaSegments()).toBe(1);

    clickTrace();

    expect(kameaSegments()).toBe(4);
  });

  it('swaps the planets for the vowel option, off by default, when Spare is chosen (D4)', () => {
    render(<App />);

    chooseSpare();

    expect(screen.queryByRole('group', { name: 'Carré planétaire' })).not.toBeInTheDocument();
    const option = screen.getByRole('switch', { name: 'Garder les voyelles' });
    expect(option).not.toBeChecked();
    expect(option).toHaveAccessibleDescription(/Spare retire les voyelles/);
    expect(screen.getByRole('button', { name: 'Autre variante' })).toBeDisabled();
  });

  it('traces a Spare sigil named without the intention, with its explanation (F2)', () => {
    render(<App />);
    chooseSpare();

    typeIntention(SPARE_INTENTION);
    clickTrace();

    const sigil = screen.getByRole('img', { name: 'Sigil de Spare, variante 1' });
    expect(sigil.outerHTML.toLowerCase()).not.toContain('tranquill');
    expect(sigil.querySelectorAll('[data-mark]')).toHaveLength(0);
    expect(screen.getByText('Variante 1')).toBeInTheDocument();
    expect(
      screen.getByText('Sigil de Spare tracé : 5 lettres retenues, variante 1.'),
    ).toBeInTheDocument();

    const panel = explanationPanel();
    const titles = panel.getAllByRole('heading', { level: 3 }).map((title) => title.textContent);
    expect(titles).toEqual([
      'Lettres retirées',
      'Squelettes anguleux',
      'Accroche sur la hampe',
      'Choix de la variante',
      'Simplification',
    ]);
    const strip = panel.getByRole('list', { name: 'Les 12 lettres de l’intention' });
    expect(within(strip).getAllByRole('listitem')[2]).toHaveTextContent('A, retirée : voyelle');
    expect(within(strip).getAllByRole('listitem')[8]).toHaveTextContent('L, retirée : doublon');
    expect(panel.getByText('L I T')).toBeInTheDocument();
    expect(panel.getByText('A U I E')).toBeInTheDocument();
    expect(panel.getByText('T R N Q L')).toBeInTheDocument();
    const tiles = panel.getByRole('list', { name: 'Squelettes anguleux des lettres retenues' });
    expect(
      within(tiles)
        .getAllByRole('listitem')
        .map((tile) => tile.querySelector('[translate="no"]')?.textContent),
    ).toEqual(['T', 'R', 'N', 'Q', 'L']);
    expect(
      panel.getByRole('img', {
        name: 'La hampe en trait appuyé et les 5 lettres accrochées, avant fusion',
      }),
    ).toBeInTheDocument();
    const hooked = panel.getByRole('list', { name: 'Lettres accrochées, de haut en bas' });
    const hookedLetters = within(hooked)
      .getAllByRole('listitem')
      .map((item) => item.querySelector('[translate="no"]')?.textContent);
    expect([...hookedLetters].sort()).toEqual(['L', 'N', 'Q', 'R', 'T']);
    expect(
      panel.getByText(/^Cette variante est (symétrique|appariée|mixte) :/),
    ).toBeInTheDocument();
    // T R N Q L: five retained letters, as many candidates as the Spare budget gives them.
    expect(
      panel.getByText(new RegExp(`^Parmi ${String(candidateCountFor(5))} runes tirées`)),
    ).toBeInTheDocument();
    expect(
      panel.getByText(/segments deviennent|compte toujours \d+ segments|on passe de \d+ à/),
    ).toBeInTheDocument();
  });

  it('draws another, reproducible sigil for each variant', () => {
    const { unmount } = render(<App />);
    chooseSpare();
    typeIntention(SPARE_INTENTION);
    clickTrace();
    const first = spareStrokes();

    fireEvent.click(screen.getByRole('button', { name: 'Autre variante' }));

    expect(screen.getByRole('img', { name: 'Sigil de Spare, variante 2' })).toBeInTheDocument();
    const second = spareStrokes();
    expect(second).not.toEqual(first);
    unmount();

    render(<App />);
    chooseSpare();
    typeIntention(SPARE_INTENTION);
    clickTrace();
    expect(spareStrokes()).toEqual(first);
    fireEvent.click(screen.getByRole('button', { name: 'Autre variante' }));
    expect(spareStrokes()).toEqual(second);
  });

  it('keeps the variant when tracing again, and goes back to the first one on any change', () => {
    render(<App />);
    chooseSpare();
    typeIntention(SPARE_INTENTION);
    clickTrace();
    fireEvent.click(screen.getByRole('button', { name: 'Autre variante' }));

    clickTrace();
    expect(screen.getByRole('img', { name: 'Sigil de Spare, variante 2' })).toBeInTheDocument();

    typeIntention('Sérénité');
    clickTrace();
    expect(screen.getByRole('img', { name: 'Sigil de Spare, variante 1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Autre variante' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Garder les voyelles' }));
    clickTrace();
    expect(screen.getByRole('img', { name: 'Sigil de Spare, variante 1' })).toBeInTheDocument();
  });

  it('keeps the vowels when asked, removing duplicates only', () => {
    render(<App />);
    chooseSpare();
    typeIntention(SPARE_INTENTION);
    clickTrace();
    const withoutVowels = spareStrokes();

    fireEvent.click(screen.getByRole('switch', { name: 'Garder les voyelles' }));
    clickTrace();

    const panel = explanationPanel();
    expect(panel.getByText('T R A N Q U I L E')).toBeInTheDocument();
    expect(panel.queryByText(/^Voyelles/)).not.toBeInTheDocument();
    expect(spareStrokes()).not.toEqual(withoutVowels);
    expect(
      screen.getByText('Sigil de Spare tracé : 9 lettres retenues, variante 1.'),
    ).toBeInTheDocument();
  });

  it('does not replay the tracing when a control changes after a Spare trace', () => {
    render(<App />);
    chooseSpare();
    typeIntention(SPARE_INTENTION);
    clickTrace();
    const firstRun = currentRun(/^Sigil de Spare/);

    fireEvent.click(screen.getByRole('switch', { name: 'Garder les voyelles' }));
    typeIntention('Sérénité');

    expect(currentRun(/^Sigil de Spare/)).toBe(firstRun);
  });

  it('offers to keep the vowels when none of the letters is left ("oui", F2)', () => {
    render(<App />);
    chooseSpare();
    typeIntention('oui');
    clickTrace();

    const field = screen.getByLabelText('Intention');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription(/Gardez les voyelles pour la tracer/);
    expect(screen.queryByRole('img', { name: /^Sigil de Spare/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Garder les voyelles et tracer' }));

    expect(screen.getByRole('img', { name: 'Sigil de Spare, variante 1' })).toBeInTheDocument();
    const option = screen.getByRole('switch', { name: 'Garder les voyelles' });
    expect(option).toBeChecked();
    expect(option).toHaveFocus();
    expect(
      screen.queryByRole('button', { name: 'Garder les voyelles et tracer' }),
    ).not.toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'false');
  });

  it('signals ignored characters once, for Spare as for kamea', () => {
    render(<App />);
    chooseSpare();

    typeIntention('Calme2026');
    clickTrace();

    expect(screen.getAllByText(/Caractères ignorés|Ignorés car/)).toHaveLength(1);
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
  it('keeps the intention field out of page translation (S8)', () => {
    render(<App />);

    expect(screen.getByLabelText('Intention')).toHaveAttribute('translate', 'no');
  });

  it('warns in the export dialog that a kamea sigil can be read back, not for Spare (S1)', () => {
    stubNativeDialog();
    render(<App />);
    typeIntention(INTENTION);
    clickTrace();
    fireEvent.click(screen.getByRole('button', { name: 'Exporter' }));

    const dialog = screen.getByRole('dialog', { name: 'Exporter le sigil' });
    expect(
      within(dialog).getByText(/peut être relu par quelqu’un qui connaît la méthode/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));

    chooseSpare();
    clickTrace();
    fireEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    expect(screen.getByRole('dialog', { name: 'Exporter le sigil' })).toBeInTheDocument();
    expect(screen.queryByText(/peut être relu/)).toBeNull();
  });

  it('opens the privacy note from the footer and closes it, focus back on its button (S9)', () => {
    stubNativeDialog();
    render(<App />);
    const opener = screen.getByRole('button', { name: 'Confidentialité' });
    expect(opener.closest('footer')).not.toBeNull();

    opener.focus();
    fireEvent.click(opener);
    const note = screen.getByRole('dialog', { name: 'Confidentialité' });
    expect(within(note).getByText(/n’est envoyée nulle part ni enregistrée/)).toBeInTheDocument();
    expect(within(note).getByText(/la langue et le thème/)).toBeInTheDocument();
    expect(
      within(note).getByText(/GitHub Pages, qui journalise les adresses IP/),
    ).toBeInTheDocument();
    expect(within(note).getByText(/Un sigil kamea peut être relu/)).toBeInTheDocument();

    fireEvent.click(within(note).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
});
