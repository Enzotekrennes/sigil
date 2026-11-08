/**
 * Controls of the "Style" section: tattoo stencil mode, stroke width, rounded
 * or flat ends, and the framing circle of the sigil.
 *
 * Exposes `StylePanel`. Controlled: the parent owns the `StyleOptions` and the
 * stencil stroke, and gets a whole new value on every change. These settings
 * only change how the sigil is drawn, never its shape, and they do not replay
 * the tracing. They are kept in memory only (nothing is stored).
 *
 * In stencil mode the sigil is pure black on pure white, without the framing
 * circle (its switch is hidden), and the width is set in millimetres on
 * paper for the print size chosen in the export dialog; the parent converts
 * it into frame units. Leaving the mode gives back the width set before.
 */
import { Slider, Switch } from '../components/ui/index.ts';
import {
  snapStencilStrokeMm,
  snapStrokeWidth,
  STENCIL_STROKE_MM_MAX,
  STENCIL_STROKE_MM_MIN,
  STENCIL_STROKE_MM_STEP,
  STROKE_WIDTH_MAX,
  STROKE_WIDTH_MIN,
  STROKE_WIDTH_STEP,
  strokeWidthLevel,
} from '../features/sigil/index.ts';
import type { StyleOptions } from '../features/sigil/types.ts';
import type { AppStrings } from './strings.fr.ts';

/** Id of the stencil mode switch. */
const STENCIL_FIELD_ID = 'style-stencil';

/** Id of the stroke width slider. */
const STROKE_WIDTH_FIELD_ID = 'style-stroke-width';

/** Id of the stencil stroke slider, in millimetres. */
const STROKE_MM_FIELD_ID = 'style-stroke-mm';

/** Id of the rounded ends switch. */
const ROUND_ENDS_FIELD_ID = 'style-round-ends';

/** Id of the framing circle switch. */
const FRAME_CIRCLE_FIELD_ID = 'style-frame-circle';

/** Props of `StylePanel`. */
export interface StylePanelProps {
  /** Current settings. */
  readonly value: StyleOptions;
  /** Called with the complete new settings after any change. */
  readonly onChange: (value: StyleOptions) => void;
  /** Stencil stroke on paper, in millimetres. */
  readonly strokeMm: number;
  /** Called with a new stencil stroke, snapped to the setting's grid. */
  readonly onStrokeMmChange: (millimetres: number) => void;
  /** Print size the stencil stroke is converted for, in centimetres. */
  readonly printSizeCm: number;
  /** Texts of the section, in the interface language. */
  readonly strings: AppStrings['style'];
}

/**
 * Renders the style controls: the stencil switch, then the width in frame
 * units (screen) or in millimetres (stencil), the ends, and the framing
 * circle outside stencil mode.
 *
 * @returns The controls, stacked.
 */
export function StylePanel({
  value,
  onChange,
  strokeMm,
  onStrokeMmChange,
  printSizeCm,
  strings,
}: StylePanelProps) {
  const level = strokeWidthLevel(value.strokeWidth);
  const stencil = value.mode === 'stencil';

  return (
    <div className="style-panel">
      <Switch
        id={STENCIL_FIELD_ID}
        label={strings.stencil}
        checked={stencil}
        onCheckedChange={(checked) => {
          onChange({ ...value, mode: checked ? 'stencil' : 'screen' });
        }}
        onText={strings.on}
        offText={strings.off}
        help={strings.stencilHelp(printSizeCm)}
      />
      {stencil ? (
        <Slider
          id={STROKE_MM_FIELD_ID}
          label={strings.strokeWidth}
          value={strokeMm}
          min={STENCIL_STROKE_MM_MIN}
          max={STENCIL_STROKE_MM_MAX}
          step={STENCIL_STROKE_MM_STEP}
          valueText={strings.strokeMmValue(strokeMm)}
          help={strings.strokeMmHelp}
          onValueChange={(millimetres) => {
            onStrokeMmChange(snapStencilStrokeMm(millimetres));
          }}
        />
      ) : (
        <Slider
          id={STROKE_WIDTH_FIELD_ID}
          label={strings.strokeWidth}
          value={value.strokeWidth}
          min={STROKE_WIDTH_MIN}
          max={STROKE_WIDTH_MAX}
          step={STROKE_WIDTH_STEP}
          valueText={strings.strokeWidthValue(value.strokeWidth, level)}
          ariaValueText={strings.strokeWidthSpoken(value.strokeWidth, level)}
          help={strings.strokeWidthHelp}
          onValueChange={(width) => {
            onChange({ ...value, strokeWidth: snapStrokeWidth(width) });
          }}
        />
      )}
      <Switch
        id={ROUND_ENDS_FIELD_ID}
        label={strings.roundEnds}
        checked={value.roundEnds}
        onCheckedChange={(roundEnds) => {
          onChange({ ...value, roundEnds });
        }}
        onText={strings.on}
        offText={strings.off}
      />
      {!stencil && (
        <Switch
          id={FRAME_CIRCLE_FIELD_ID}
          label={strings.frameCircle}
          checked={value.frameCircle}
          onCheckedChange={(frameCircle) => {
            onChange({ ...value, frameCircle });
          }}
          onText={strings.on}
          offText={strings.off}
        />
      )}
    </div>
  );
}
