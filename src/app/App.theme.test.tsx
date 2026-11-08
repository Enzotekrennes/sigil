/**
 * Component tests of the theme selector in the header (scenario F6): the
 * system setting on first load, the stored choice on later loads, what a
 * choice changes on `<html>` and in storage (the theme name only), and that
 * switching theme leaves the intention and the sigil untouched.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App.tsx';
import { THEME_STORAGE_KEY } from './theme.ts';

/**
 * Picks a theme in the header selector.
 *
 * @param name - Name of the theme as announced in French.
 */
function pickTheme(name: 'Système' | 'Encre sur papier' | 'Or sur noir'): void {
  fireEvent.click(screen.getByRole('radio', { name }));
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR']);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme selector', () => {
  it('sits in the header after the language, as a group of three named choices', () => {
    render(<App />);

    const group = screen.getByRole('group', { name: 'Thème' });
    const language = screen.getByRole('group', { name: 'Langue de l’interface' });
    expect(group.closest('header')).not.toBeNull();
    expect(language.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      screen.getAllByRole('radio', { name: /^(Système|Encre sur papier|Or sur noir)$/ }),
    ).toHaveLength(3);
  });

  it('follows the system on first load and stores nothing', () => {
    render(<App />);

    expect(screen.getByRole('radio', { name: 'Système' })).toBeChecked();
    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(localStorage).toHaveLength(0);
  });

  it('applies and stores an explicit theme, and forgets it back on the system setting', () => {
    render(<App />);

    pickTheme('Or sur noir');

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage).toHaveLength(1);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    pickTheme('Encre sur papier');

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    pickTheme('Système');

    expect(document.documentElement).not.toHaveAttribute('data-theme');
    expect(localStorage).toHaveLength(0);
  });

  it('starts on the stored theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<App />);

    expect(screen.getByRole('radio', { name: 'Or sur noir' })).toBeChecked();
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('falls back to the system setting on an invalid stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    render(<App />);

    expect(screen.getByRole('radio', { name: 'Système' })).toBeChecked();
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('keeps the intention and the sigil shown', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Je suis calme' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tracer' }));
    const strokes = screen.getByRole('img', { name: 'Sigil kamea de Saturne' }).innerHTML;

    pickTheme('Or sur noir');

    expect(screen.getByRole('textbox')).toHaveValue('Je suis calme');
    expect(screen.getByRole('img', { name: 'Sigil kamea de Saturne' }).innerHTML).toBe(strokes);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('names the choices in English in the English interface', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'English' }));

    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Gold on black' })).toBeInTheDocument();
  });
});
