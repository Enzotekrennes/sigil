/**
 * Component tests of the modal dialog: named by its title, opened and closed
 * with `open`, Escape reported to the parent, Tab kept inside, and the focus
 * given back to the element that opened it. jsdom has no `showModal`, so the
 * native methods are stubbed the way a browser behaves (open attribute, and a
 * `close` event when closed).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Button } from './Button.tsx';
import { Dialog } from './Dialog.tsx';
import { stubNativeDialog } from './dialogStub.ts';

beforeEach(() => {
  stubNativeDialog();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * A button that opens a dialog with two buttons, as a screen would use it.
 *
 * @returns The opener and the dialog.
 */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Exporter
      </Button>
      <Dialog
        open={open}
        title="Exporter le sigil"
        onClose={() => {
          setOpen(false);
        }}
      >
        <Button>Premier</Button>
        <Button
          onClick={() => {
            setOpen(false);
          }}
        >
          Dernier
        </Button>
      </Dialog>
    </>
  );
}

/**
 * Opens the dialog from its button, focused first as a keyboard user would.
 *
 * @returns The opener.
 */
function openDialog(): HTMLElement {
  const opener = screen.getByRole('button', { name: 'Exporter' });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

describe('Dialog', () => {
  it('is closed and empty until opened, then named by its title', () => {
    render(<Harness />);

    expect(screen.queryByRole('dialog')).toBeNull();
    openDialog();

    expect(screen.getByRole('dialog', { name: 'Exporter le sigil' })).toHaveAttribute('open');
    expect(screen.getByRole('heading', { name: 'Exporter le sigil' })).toBeInTheDocument();
  });

  it('keeps Tab inside: from the last element to the first, and back', () => {
    render(<Harness />);
    openDialog();
    const dialog = screen.getByRole('dialog');
    const first = screen.getByRole('button', { name: 'Premier' });
    const last = screen.getByRole('button', { name: 'Dernier' });

    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(first).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('tells the parent when Escape closes it, and gives the focus back to the opener', () => {
    render(<Harness />);
    const opener = openDialog();
    const dialog = screen.getByRole('dialog');
    screen.getByRole('button', { name: 'Premier' }).focus();

    // What a browser does on Escape: the native element closes itself.
    dialog.removeAttribute('open');
    fireEvent(dialog, new Event('close'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('gives the focus back to the opener when the content closes it', () => {
    render(<Harness />);
    const opener = openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Dernier' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
});
