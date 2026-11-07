/**
 * Export buttons of the scene: "SVG" and "PNG", grouped under a visible
 * "Export" label, disabled while no sigil is shown, with a busy state while
 * the PNG is rasterised and an error message when an export fails.
 *
 * Exposes `ExportActions`, its props and `ExportStrings`. Holds no wording of
 * its own: every text comes from the interface dictionary. Never receives the
 * intention, so it cannot end up in a file or its name.
 */
import { useId, useState } from 'react';

import { Button, StatusMessage } from '../../components/ui/index.ts';
import type { Sigil, StyleOptions } from '../sigil/types.ts';
import './ExportActions.css';
import { exportSigilPng, exportSigilSvg } from './exportSigil.ts';
import type { ExportFormat, SigilMethod } from './fileName.ts';

/** Texts of the export buttons, in the interface language. */
export interface ExportStrings {
  /** Visible name of the group of buttons ("Exporter"). */
  readonly label: string;
  /** Label of the SVG button. */
  readonly svg: string;
  /** Label of the PNG button. */
  readonly png: string;
  /** Message shown when an export fails, given the format's label. */
  readonly error: (format: string) => string;
}

/** Props of `ExportActions`. */
export interface ExportActionsProps {
  /** Sigil shown on the scene; `undefined` disables both buttons. */
  readonly sigil: Sigil | undefined;
  /** Method of that sigil, written in the file name. */
  readonly method: SigilMethod | undefined;
  /** Style settings shown, applied to the exported file. */
  readonly styleOptions: StyleOptions;
  /** Interface texts. */
  readonly strings: ExportStrings;
}

/**
 * Renders the export group and runs an export on click.
 *
 * @returns The labelled group of buttons, followed by an error message after a failed export.
 */
export function ExportActions({ sigil, method, styleOptions, strings }: ExportActionsProps) {
  const labelId = useId();
  const [pngBusy, setPngBusy] = useState(false);
  const [failed, setFailed] = useState<ExportFormat | null>(null);
  const target =
    sigil === undefined || method === undefined ? undefined : { sigil, styleOptions, method };

  /**
   * Records the outcome of an export; failures are logged for diagnosis
   * (the message carries no user data) and shown to the user.
   *
   * @param format - Format attempted.
   * @param error - What was thrown, or `undefined` on success.
   */
  function settle(format: ExportFormat, error?: unknown) {
    if (error === undefined) {
      setFailed(null);
      return;
    }
    console.error(`Sigil ${format.toUpperCase()} export failed.`, error);
    setFailed(format);
  }

  /** Downloads the SVG file at once. */
  function handleSvg() {
    if (target === undefined) return;
    try {
      exportSigilSvg(target);
      settle('svg');
    } catch (error) {
      settle('svg', error);
    }
  }

  /** Rasterises then downloads the PNG; the button stays busy meanwhile. */
  async function handlePng() {
    if (target === undefined || pngBusy) return;
    setPngBusy(true);
    try {
      await exportSigilPng(target);
      settle('png');
    } catch (error) {
      settle('png', error);
    } finally {
      setPngBusy(false);
    }
  }

  return (
    <>
      <div className="export-actions" role="group" aria-labelledby={labelId}>
        <span id={labelId} className="export-actions__label">
          {strings.label}
        </span>
        <Button variant="secondary" disabled={target === undefined} onClick={handleSvg}>
          {strings.svg}
        </Button>
        <Button
          variant="secondary"
          disabled={target === undefined || pngBusy}
          aria-busy={pngBusy}
          onClick={() => void handlePng()}
        >
          {strings.png}
        </Button>
      </div>
      {failed !== null && (
        <div className="export-actions__status">
          <StatusMessage tone="error">
            {strings.error(failed === 'svg' ? strings.svg : strings.png)}
          </StatusMessage>
        </div>
      )}
    </>
  );
}
