/**
 * Application shell: the single screen of Sigil.
 *
 * Assembles the header, the trace controls (intention, method, planet), the
 * sigil scene with its replay button, and the "how it is made" panel. Owns
 * the screen state only; normalisation and sigil construction live in the
 * features, chained by `traceKamea`.
 *
 * Privacy (decision D8): the intention lives in React state only. It is
 * never put in the URL, in storage or in an attribute; the form never
 * submits (its submit event is cancelled, and the CSP forbids form actions).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SubmitEvent } from 'react';

import {
  Button,
  Disclosure,
  SegmentedControl,
  StatusMessage,
  TextField,
} from '../components/ui/index.ts';
import type { SegmentedOption } from '../components/ui/index.ts';
// The hidden headings and live region use the shared `visually-hidden` class.
import '../components/ui/VisuallyHidden.css';
import { KameaExplanation } from '../features/explain/index.ts';
import { normalizeIntention } from '../features/intention/index.ts';
import type { Planet } from '../features/sigil/types.ts';
import './App.css';
import { PlanetPicker } from './PlanetPicker.tsx';
import { SigilStage } from './SigilStage.tsx';
import { STRINGS_FR } from './strings.fr.ts';
import { traceErrorMessage, traceKamea } from './traceKamea.ts';

/** Sigil methods offered on the screen; Spare is shown but not available yet. */
type Method = 'kamea' | 'spare';

/** What the user asked to trace, captured when the "Trace" button is pressed. */
interface TraceRequest {
  readonly source: string;
  readonly planet: Planet;
}

/** Planet selected on first load: the smallest square, the one of the F1 example. */
const DEFAULT_PLANET: Planet = 'saturn';

/** Id of the intention input, from which its help and error ids derive. */
const INTENTION_FIELD_ID = 'intention';

/** Id of the visually hidden heading of the controls section. */
const CONTROLS_HEADING_ID = 'controls-heading';

/** Id of the visually hidden heading of the scene section. */
const STAGE_HEADING_ID = 'stage-heading';

/**
 * Renders the whole screen and wires the trace flow:
 * text → normalisation → kamea sigil → scene and explanation panel.
 *
 * @returns The application screen.
 */
export function App() {
  const strings = STRINGS_FR;
  const [source, setSource] = useState('');
  const [method, setMethod] = useState<Method>('kamea');
  const [planet, setPlanet] = useState<Planet>(DEFAULT_PLANET);
  const [request, setRequest] = useState<TraceRequest | null>(null);
  const [replayToken, setReplayToken] = useState(0);
  // null until the user opens or closes the panel: it then follows the result.
  const [explainToggled, setExplainToggled] = useState<boolean | null>(null);
  const intentionInput = useRef<HTMLInputElement>(null);

  // Computed once per request: a new Sigil object would restart the tracing
  // animation on every render of the screen.
  const result = useMemo(
    () => (request === null ? null : traceKamea(request.source, request.planet)),
    [request],
  );
  const letterCount = useMemo(() => {
    const normalized = normalizeIntention(source);
    return normalized.ok ? normalized.intention.letters.length : 0;
  }, [source]);

  const traced = result?.ok === true ? result : undefined;
  const error = result?.ok === false ? traceErrorMessage(result.error, strings) : undefined;
  const explainOpen = explainToggled ?? traced !== undefined;

  // After a failed trace, focus goes back to the field, whose description now holds the error.
  useEffect(() => {
    if (result?.ok === false) intentionInput.current?.focus();
  }, [result]);

  const methodOptions: SegmentedOption<Method>[] = [
    { value: 'spare', label: strings.method.spare, disabled: true, note: strings.method.soon },
    { value: 'kamea', label: strings.method.kamea },
  ];

  /**
   * Starts a trace with the current text and planet, without submitting anything.
   *
   * @param event - Submit event of the controls form, cancelled here.
   */
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequest({ source, planet });
  }

  /**
   * Keeps the typed text and clears a stale error as soon as the text changes.
   *
   * @param value - New text of the field.
   */
  function handleIntentionChange(value: string) {
    setSource(value);
    if (result?.ok === false) setRequest(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-header__title">{strings.appTitle}</h1>
      </header>

      <main className="app-layout">
        <section className="app-layout__controls" aria-labelledby={CONTROLS_HEADING_ID}>
          <h2 id={CONTROLS_HEADING_ID} className="visually-hidden">
            {strings.controls.heading}
          </h2>
          <form className="trace-form" noValidate onSubmit={handleSubmit}>
            <div className="trace-form__intention">
              <TextField
                id={INTENTION_FIELD_ID}
                label={strings.intention.label}
                value={source}
                onValueChange={handleIntentionChange}
                help={strings.intention.help}
                counter={strings.intention.letterCount(letterCount)}
                error={error}
                inputRef={intentionInput}
                autoComplete="off"
                autoCapitalize="sentences"
                spellCheck={false}
              />
            </div>
            <div className="trace-form__method">
              <SegmentedControl
                legend={strings.method.legend}
                name="method"
                options={methodOptions}
                value={method}
                onChange={setMethod}
              />
              {method === 'kamea' && (
                <PlanetPicker value={planet} onChange={setPlanet} strings={strings.planet} />
              )}
            </div>
            <Button type="submit" variant="primary" fullWidth className="trace-form__submit">
              {strings.trace}
            </Button>
            {traced !== undefined && traced.ignored.length > 0 && (
              <StatusMessage tone="warning">{strings.ignoredWarning(traced.ignored)}</StatusMessage>
            )}
          </form>
        </section>

        <section className="app-layout__stage" aria-labelledby={STAGE_HEADING_ID}>
          <h2 id={STAGE_HEADING_ID} className="visually-hidden">
            {strings.stage.heading}
          </h2>
          <SigilStage
            sigil={traced?.sigil}
            label={traced === undefined ? '' : strings.stage.label(traced.planet)}
            emptyText={error === undefined ? strings.stage.empty : strings.stage.error}
            replayToken={replayToken}
          />
          <div className="stage-actions">
            <Button
              variant="secondary"
              disabled={traced === undefined}
              onClick={() => {
                setReplayToken((token) => token + 1);
              }}
            >
              {strings.replay}
            </Button>
          </div>
          <p className="visually-hidden" role="status">
            {traced === undefined ? '' : strings.stage.traced(traced.letterCount, traced.planet)}
          </p>
        </section>

        <section className="app-layout__explain">
          <Disclosure
            title={strings.explain.title}
            open={explainOpen}
            onOpenChange={setExplainToggled}
          >
            {traced === undefined ? (
              <p className="app-layout__explain-empty">{strings.explain.empty}</p>
            ) : (
              <KameaExplanation
                sigil={traced.sigil}
                ignored={traced.ignored}
                strings={strings.explain.kamea}
              />
            )}
          </Disclosure>
        </section>
      </main>
    </div>
  );
}
