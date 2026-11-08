/**
 * Application shell: the single screen of Sigil.
 *
 * Assembles the header (title, FR | EN selector and theme selector), the trace controls
 * (intention, method, then the planet for kamea or the vowel option for
 * Spare), the sigil scene with its actions (replay, another Spare variant,
 * the "Export" dialog for SVG, PNG and the real-size stencil PDF), the
 * "Style" section (tattoo stencil, stroke width, ends, framing circle) and
 * the "how it is made" panel of the method used.
 *
 * Owns the tattoo stencil settings shared by the "Style" section and the
 * export dialog: the stroke in millimetres and the print size typed. In
 * stencil mode the sigil is drawn with the stroke width that prints at those
 * millimetres for that size (`stencilScale`); the last valid size is used
 * while the field holds an invalid one. Owns the screen state only; normalisation and sigil construction live
 * in the features, chained by `trace.ts`, and the replay (animated, or step
 * by step under reduced motion) in `useTraceReplay`.
 *
 * Style settings live in React state only and are not persisted. The colour
 * theme (system, ink on paper, gold on black) is held by `useTheme`, which
 * applies it to `<html>` and stores the choice. The
 * interface language is held by `LanguageProvider` around the screen:
 * switching it only re-renders the screen, so the intention typed, the sigil
 * shown and its animation are kept as they are.
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
  Switch,
  TextField,
} from '../components/ui/index.ts';
import type { SegmentedOption } from '../components/ui/index.ts';
// The hidden headings and live region use the shared `visually-hidden` class.
import '../components/ui/VisuallyHidden.css';
import { KameaExplanation, SpareExplanation } from '../features/explain/index.ts';
import {
  ExportDialog,
  MM_PER_CM,
  parsePrintSize,
  PRINT_SIZE_DEFAULT_CM,
} from '../features/export/index.ts';
import { LanguageProvider, LanguageToggle, useLanguage } from '../features/i18n/index.ts';
import { normalizeIntention } from '../features/intention/index.ts';
import {
  DEFAULT_STYLE_OPTIONS,
  STENCIL_STROKE_MM_DEFAULT,
  stencilScale,
  useTraceReplay,
} from '../features/sigil/index.ts';
import type { Sigil } from '../features/sigil/types.ts';
import type { Planet, StyleOptions } from '../features/sigil/types.ts';
import './App.css';
import { PlanetPicker } from './PlanetPicker.tsx';
import { SigilStage } from './SigilStage.tsx';
import type { AppStrings } from './strings.fr.ts';
import { useStrings } from './strings.ts';
import { StylePanel } from './StylePanel.tsx';
import { useTheme } from './theme.ts';
import { ThemeToggle } from './ThemeToggle.tsx';
import { traceErrorMessage, traceKamea, traceSpare } from './trace.ts';
import type { Trace, TraceResult } from './trace.ts';

/** Sigil methods offered on the screen. */
type Method = 'kamea' | 'spare';

/**
 * What the user asked to trace, captured when "Trace" (or "Another variant")
 * is pressed: later edits of the controls do not touch the sigil shown.
 */
type TraceRequest =
  | { readonly method: 'kamea'; readonly source: string; readonly planet: Planet }
  | {
      readonly method: 'spare';
      readonly source: string;
      readonly keepVowels: boolean;
      /** Variant number, 0 for the first sigil (see `nextSpareVariant`). */
      readonly variant: number;
    };

/** Method selected on first load: kamea, the method of the F1 example. */
const DEFAULT_METHOD: Method = 'kamea';

/** Planet selected on first load: the smallest square, the one of the F1 example. */
const DEFAULT_PLANET: Planet = 'saturn';

/** Spare removes vowels unless asked to keep them (decision D4). */
const DEFAULT_KEEP_VOWELS = false;

/** Id of the intention input, from which its help and error ids derive. */
const INTENTION_FIELD_ID = 'intention';

/** Id of the "keep the vowels" switch, from which its help id derives. */
const KEEP_VOWELS_FIELD_ID = 'keep-vowels';

/** Id of the visually hidden heading of the controls section. */
const CONTROLS_HEADING_ID = 'controls-heading';

/** Id of the visually hidden heading of the scene section. */
const STAGE_HEADING_ID = 'stage-heading';

/** Id of the hint telling how "replay" works under reduced motion. */
const REPLAY_HINT_ID = 'replay-hint';

/**
 * Viewport from which the "Style" section starts open: the two- and
 * three-column layouts (1024 px, see App.css), where it sits in the controls
 * column as in the design. On narrower screens it starts folded under the
 * scene, as the design's mobile layout asks.
 */
const STYLE_OPEN_QUERY = '(min-width: 1024px)';

/**
 * Renders the application: the screen inside the provider of the interface
 * language (stored choice, else detected from the browser).
 *
 * @returns The application, ready to mount.
 */
export function App() {
  return (
    <LanguageProvider>
      <SigilScreen />
    </LanguageProvider>
  );
}

/**
 * Renders the whole screen and wires the trace flow:
 * text → normalisation → kamea or Spare sigil → scene and explanation panel.
 *
 * @returns The application screen, in the current interface language.
 */
function SigilScreen() {
  const strings = useStrings();
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [source, setSource] = useState('');
  const [method, setMethod] = useState<Method>(DEFAULT_METHOD);
  const [planet, setPlanet] = useState<Planet>(DEFAULT_PLANET);
  const [keepVowels, setKeepVowels] = useState(DEFAULT_KEEP_VOWELS);
  const [request, setRequest] = useState<TraceRequest | null>(null);
  const [styleOptions, setStyleOptions] = useState<StyleOptions>(DEFAULT_STYLE_OPTIONS);
  const [stencilStrokeMm, setStencilStrokeMm] = useState(STENCIL_STROKE_MM_DEFAULT);
  const [printSizeText, setPrintSizeText] = useState(String(PRINT_SIZE_DEFAULT_CM));
  const [printSizeCm, setPrintSizeCm] = useState(PRINT_SIZE_DEFAULT_CM);
  const [styleOpen, setStyleOpen] = useState(startsWide);
  // null until the user opens or closes the panel: it then follows the result.
  const [explainToggled, setExplainToggled] = useState<boolean | null>(null);
  const intentionInput = useRef<HTMLInputElement>(null);
  const keepVowelsInput = useRef<HTMLInputElement>(null);

  // Computed once per request: a new Sigil object would restart the tracing
  // animation on every render of the screen (typing, toggling a control).
  const result = useMemo(() => (request === null ? null : traceRequest(request)), [request]);
  const letterCount = useMemo(() => {
    const normalized = normalizeIntention(source);
    return normalized.ok ? normalized.intention.letters.length : 0;
  }, [source]);

  const traced = result?.ok === true ? result : undefined;
  const replay = useTraceReplay(traced?.sigil);
  const error = result?.ok === false ? traceErrorMessage(result.error, strings) : undefined;
  const shownStyle = useMemo(
    () => shownStyleOptions(traced?.sigil, styleOptions, stencilStrokeMm, printSizeCm),
    [traced?.sigil, styleOptions, stencilStrokeMm, printSizeCm],
  );
  const explainOpen = explainToggled ?? traced !== undefined;
  const offersKeepVowels =
    result?.ok === false &&
    result.error.code === 'NO_LETTER_LEFT' &&
    result.error.suggestKeepVowels &&
    request?.method === 'spare' &&
    !request.keepVowels;

  // After a failed trace, focus goes back to the field, whose description now holds the error.
  useEffect(() => {
    if (result?.ok === false) intentionInput.current?.focus();
  }, [result]);

  const methodOptions: SegmentedOption<Method>[] = [
    { value: 'spare', label: strings.method.spare },
    { value: 'kamea', label: strings.method.kamea },
  ];

  /**
   * Starts a trace with the current controls, without submitting anything.
   *
   * @param event - Submit event of the controls form, cancelled here.
   */
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequest(
      method === 'kamea'
        ? { method, source, planet }
        : {
            method,
            source,
            keepVowels,
            variant: nextSpareVariant(request, source, keepVowels),
          },
    );
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

  /**
   * Keeps the print size typed, and the last valid one for the stencil stroke.
   *
   * @param text - New content of the size field.
   */
  function handlePrintSizeChange(text: string) {
    setPrintSizeText(text);
    const size = parsePrintSize(text);
    if (size.ok) setPrintSizeCm(size.centimetres);
  }

  /** Draws the next variant of the Spare sigil shown, with its own intention and option. */
  function handleOtherVariant() {
    if (request?.method !== 'spare') return;
    setRequest({ ...request, variant: request.variant + 1 });
  }

  /**
   * Answers the "only vowels" error in one step: turns the option on, traces
   * again, and moves focus to the switch that just changed (the button that
   * had it disappears with the error).
   */
  function handleKeepVowelsAndTrace() {
    setKeepVowels(true);
    setRequest({ method: 'spare', source, keepVowels: true, variant: 0 });
    keepVowelsInput.current?.focus();
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-header__title">{strings.appTitle}</h1>
        <div className="app-header__settings">
          <LanguageToggle value={language} onChange={setLanguage} strings={strings.language} />
          <ThemeToggle value={theme} onChange={setTheme} strings={strings.theme} />
        </div>
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
              {offersKeepVowels && (
                <Button
                  variant="secondary"
                  className="trace-form__keep-vowels"
                  onClick={handleKeepVowelsAndTrace}
                >
                  {strings.spare.keepVowelsAndTrace}
                </Button>
              )}
            </div>
            <div className="trace-form__method">
              <SegmentedControl
                legend={strings.method.legend}
                name="method"
                options={methodOptions}
                value={method}
                onChange={setMethod}
              />
              {method === 'kamea' ? (
                <PlanetPicker value={planet} onChange={setPlanet} strings={strings.planet} />
              ) : (
                <Switch
                  id={KEEP_VOWELS_FIELD_ID}
                  label={strings.spare.keepVowels}
                  checked={keepVowels}
                  onCheckedChange={setKeepVowels}
                  onText={strings.spare.on}
                  offText={strings.spare.off}
                  help={strings.spare.keepVowelsHelp}
                  inputRef={keepVowelsInput}
                />
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
            label={traced === undefined ? '' : sigilLabel(traced, strings)}
            emptyText={emptyText(method, error !== undefined, strings)}
            styleOptions={shownStyle}
            replayToken={replay.replayToken}
            revealedSteps={replay.step}
          />
          <div className="stage-actions">
            <Button
              variant="secondary"
              disabled={traced === undefined}
              aria-describedby={replay.stepwise ? REPLAY_HINT_ID : undefined}
              onClick={replay.replay}
            >
              {strings.replay}
            </Button>
            {method === 'spare' && (
              <Button
                variant="secondary"
                disabled={traced?.method !== 'spare'}
                onClick={handleOtherVariant}
              >
                <VariantIcon />
                {strings.otherVariant}
              </Button>
            )}
            <ExportDialog
              sigil={traced?.sigil}
              method={traced?.method}
              styleOptions={shownStyle}
              strokeMm={stencilStrokeMm}
              onStrokeMmChange={setStencilStrokeMm}
              sizeText={printSizeText}
              onSizeTextChange={handlePrintSizeChange}
              strings={strings.export}
            />
          </div>
          {traced?.method === 'spare' && (
            <p className="stage-caption" aria-hidden="true">
              {strings.stage.variant(displayedVariant(traced.variant))}
            </p>
          )}
          {traced !== undefined && replay.step !== undefined && (
            <p className="stage-caption" aria-hidden="true">
              {strings.replayStep(replay.step, replay.stepCount)}
            </p>
          )}
          {replay.stepwise && (
            <p id={REPLAY_HINT_ID} className="stage-hint">
              {strings.replayStepwiseHint}
            </p>
          )}
          <p className="visually-hidden" role="status">
            {stageAnnouncement(traced, replay.step, replay.stepCount, strings)}
          </p>
        </section>

        <section className="app-layout__style">
          <Disclosure title={strings.style.title} open={styleOpen} onOpenChange={setStyleOpen}>
            <StylePanel
              value={styleOptions}
              onChange={setStyleOptions}
              strokeMm={stencilStrokeMm}
              onStrokeMmChange={setStencilStrokeMm}
              printSizeCm={printSizeCm}
              strings={strings.style}
            />
          </Disclosure>
        </section>

        <section className="app-layout__explain">
          <Disclosure
            title={strings.explain.title}
            open={explainOpen}
            onOpenChange={setExplainToggled}
          >
            {traced === undefined && (
              <p className="app-layout__explain-empty">{strings.explain.empty}</p>
            )}
            {traced?.method === 'kamea' && (
              <KameaExplanation sigil={traced.sigil} strings={strings.explain.kamea} />
            )}
            {traced?.method === 'spare' && (
              <SpareExplanation sigil={traced.sigil} strings={strings.explain.spare} />
            )}
          </Disclosure>
        </section>
      </main>
    </div>
  );
}

/**
 * Style settings the sigil is drawn and exported with: the settings chosen,
 * except in stencil mode where the stroke width is the one that prints at the
 * chosen millimetres for the chosen size.
 *
 * @param sigil - Sigil shown, if any.
 * @param styleOptions - Settings chosen in the "Style" section.
 * @param strokeMm - Stencil stroke on paper, in millimetres.
 * @param printSizeCm - Print size, in centimetres (a valid one).
 * @returns The settings to draw with; `styleOptions` itself outside stencil mode or without a sigil.
 */
function shownStyleOptions(
  sigil: Sigil | undefined,
  styleOptions: StyleOptions,
  strokeMm: number,
  printSizeCm: number,
): StyleOptions {
  if (sigil === undefined || styleOptions.mode !== 'stencil') return styleOptions;
  const { strokeWidth } = stencilScale(
    sigil,
    styleOptions.roundEnds,
    strokeMm,
    printSizeCm * MM_PER_CM,
  );
  return { ...styleOptions, strokeWidth };
}

/**
 * Runs the trace chain of the requested method.
 *
 * @param request - What the user asked to trace.
 * @returns The sigil and what the screen needs, or the business error.
 */
function traceRequest(request: TraceRequest): TraceResult {
  return request.method === 'kamea'
    ? traceKamea(request.source, request.planet)
    : traceSpare(request.source, { keepVowels: request.keepVowels, variant: request.variant });
}

/**
 * Variant number of a new Spare trace: the variant shown is kept when the
 * user traces again with the same intention and option, and goes back to 0
 * as soon as the intention, the method or the option changed.
 *
 * @param previous - Request of the sigil (or error) currently shown, if any.
 * @param source - Intention as typed now.
 * @param keepVowels - Vowel option now.
 * @returns The variant to trace, an integer ≥ 0.
 */
function nextSpareVariant(
  previous: TraceRequest | null,
  source: string,
  keepVowels: boolean,
): number {
  if (previous?.method !== 'spare') return 0;
  return previous.source === source && previous.keepVowels === keepVowels ? previous.variant : 0;
}

/**
 * Number of a Spare variant as shown to the user: the first sigil is
 * "variant 1", which reads more naturally than the internal 0.
 *
 * @param variant - Internal variant number, integer ≥ 0.
 * @returns The 1-based number shown on screen and in the accessible name.
 */
function displayedVariant(variant: number): number {
  return variant + 1;
}

/**
 * Accessible name of the sigil: method and planet or variant, never the intention.
 *
 * @param traced - Sigil shown.
 * @param strings - Interface texts.
 * @returns For instance "Sigil kamea de Saturne" or "Sigil de Spare, variante 2".
 */
function sigilLabel(traced: Trace, strings: AppStrings): string {
  return traced.method === 'kamea'
    ? strings.stage.label(traced.planet)
    : strings.stage.spareLabel(displayedVariant(traced.variant));
}

/**
 * Whether the "Style" section starts open: on the wide layouts only.
 *
 * @returns True when the viewport matches `STYLE_OPEN_QUERY`; false where
 *   `matchMedia` does not exist (some test environments).
 */
function startsWide(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(STYLE_OPEN_QUERY).matches;
}

/**
 * Sentence of the scene's live region: the step reached during a
 * step-by-step replay, otherwise what was just traced.
 *
 * @param traced - Sigil shown, if any.
 * @param step - Step reached in the step-by-step replay, if one is running.
 * @param stepCount - Steps of that replay.
 * @param strings - Interface texts.
 * @returns The sentence, empty without a sigil.
 */
function stageAnnouncement(
  traced: Trace | undefined,
  step: number | undefined,
  stepCount: number,
  strings: AppStrings,
): string {
  if (traced === undefined) return '';
  if (step !== undefined) return strings.replayStep(step, stepCount);
  return tracedAnnouncement(traced, strings);
}

/**
 * Sentence announced by the live region once a sigil is traced.
 *
 * @param traced - Sigil shown.
 * @param strings - Interface texts.
 * @returns How many letters were drawn, and on which square or as which variant.
 */
function tracedAnnouncement(traced: Trace, strings: AppStrings): string {
  return traced.method === 'kamea'
    ? strings.stage.traced(traced.letterCount, traced.planet)
    : strings.stage.spareTraced(traced.keptCount, displayedVariant(traced.variant));
}

/**
 * Text of the empty scene.
 *
 * @param method - Method selected.
 * @param failed - Whether the last trace failed.
 * @param strings - Interface texts.
 * @returns A pointer to the error under the field, or the invitation of the method.
 */
function emptyText(method: Method, failed: boolean, strings: AppStrings): string {
  if (failed) return strings.stage.error;
  return method === 'kamea' ? strings.stage.empty : strings.stage.emptySpare;
}

/**
 * Two arrows turning, before the "Another variant" label (design: icon and
 * text). Decorative: the label carries the meaning.
 *
 * @returns An `aria-hidden` SVG icon.
 */
function VariantIcon() {
  return (
    <svg className="stage-actions__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M13 6.5A5 5 0 0 0 3.6 5M3 9.5A5 5 0 0 0 12.4 11M3.5 2.5V5H6M12.5 13.5V11H10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
