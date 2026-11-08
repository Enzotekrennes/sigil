/**
 * The privacy note of the footer: a discreet "Privacy" button and the short
 * text it opens in the shared modal `Dialog` (no route of its own).
 *
 * Exposes `PrivacyNote`, its props and `PrivacyNoteStrings`. The note says
 * what the app does with data (decision D8): nothing sent or saved, two local
 * preferences (language and theme), the host's own logging, and how readable
 * a kamea sigil stays. Holds the open state only; every text comes from the
 * dictionaries.
 */
import { useState } from 'react';

import { Button, Dialog } from '../components/ui/index.ts';
import './PrivacyNote.css';

/** Texts of the privacy note, in the interface language. */
export interface PrivacyNoteStrings {
  /** Label of the footer button that opens the note. */
  readonly open: string;
  /** Title of the dialog. */
  readonly title: string;
  /** Nothing is sent or saved: not in the address, the device or the exported files. */
  readonly nothingSent: string;
  /** The two preferences kept in the browser's storage: language and theme. */
  readonly preferences: string;
  /** The host, GitHub Pages, and the IP addresses it logs under its own policy. */
  readonly hosting: string;
  /** A kamea sigil can be read back by someone who knows the method; Spare far less. */
  readonly kameaReadable: string;
  /** Label of the button that closes the note. */
  readonly close: string;
}

/** Props of `PrivacyNote`. */
export interface PrivacyNoteProps {
  /** Interface texts. */
  readonly strings: PrivacyNoteStrings;
}

/**
 * Renders the footer button and, once it is pressed, the note in a dialog;
 * Escape or "Close" closes it and gives the focus back to the button.
 *
 * @returns The button, followed by the dialog element.
 */
export function PrivacyNote({ strings }: PrivacyNoteProps) {
  const [open, setOpen] = useState(false);

  /** Closes the note. */
  function close() {
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        className="privacy-note__open"
        onClick={() => {
          setOpen(true);
        }}
      >
        {strings.open}
      </Button>
      <Dialog open={open} title={strings.title} onClose={close}>
        <div className="privacy-note">
          <p className="privacy-note__text">{strings.nothingSent}</p>
          <p className="privacy-note__text">{strings.preferences}</p>
          <p className="privacy-note__text">{strings.hosting}</p>
          <p className="privacy-note__text">{strings.kameaReadable}</p>
        </div>
        <div className="privacy-note__actions">
          <Button variant="secondary" onClick={close}>
            {strings.close}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
