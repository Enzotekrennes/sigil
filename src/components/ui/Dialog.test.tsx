/**
 * Component tests of the modal dialog: named by its title, opened and closed
 * with `open`, Escape reported to the parent (and a late `close` event of an
 * Escape ignored once reopened), Tab kept inside, and the focus
 * given back to the element that opened it. jsdom has no `showModal`, so the
 * native methods are stubbed the way a browser behaves (open attribute, and a
 * `close` event when closed).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Button } from './Button.tsx';
import { Dialog } from './Dialog.tsx';
import { stubNativeDialog } from '../../test/dialogStub.ts';

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

  it('closes on Escape at once, the key kept from the browser, and reopens on the next press', () => {
    render(<Harness />);
    const opener = openDialog();

    for (let round = 0; round < 5; round += 1) {
      const dialog = screen.getByRole('dialog');
      screen.getByRole('button', { name: 'Premier' }).focus();
      const escape = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      fireEvent(screen.getByRole('button', { name: 'Premier' }), escape);

      expect(escape.defaultPrevented).toBe(true);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(opener).toHaveFocus();
      fireEvent.click(opener);
      expect(dialog).toHaveAttribute('open');
    }
  });

  it('reopens at once when the opener is pressed right after a native cancel, again and again', () => {
    render(<Harness />);
    const opener = openDialog();

    for (let round = 0; round < 5; round += 1) {
      const dialog = screen.getByRole('dialog');
      // Escape in a browser: `cancel` first, then the element closes and `close` is queued.
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(opener).toHaveFocus();

      // Enter on the opener before the queued `close` event is handled.
      fireEvent.click(opener);
      expect(screen.getByRole('dialog')).toHaveAttribute('open');

      // The late `close` event of the Escape must not close the reopened dialog.
      fireEvent(dialog, new Event('close'));
      expect(screen.getByRole('dialog', { name: 'Exporter le sigil' })).toHaveAttribute('open');
    }
  });

  it('gives the focus back to the opener when the content closes it', () => {
    render(<Harness />);
    const opener = openDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Dernier' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
});
