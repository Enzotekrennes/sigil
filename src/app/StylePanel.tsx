/**
 * Controls of the "Style" section: stroke width, rounded or flat ends, and
 * the framing circle of the sigil.
 *
 * Exposes `StylePanel`. Controlled: the parent owns the `StyleOptions` and
 * gets a whole new value on every change. These settings only change how the
 * sigil is drawn, never its shape, and they do not replay the tracing. They
 * are kept in memory only (nothing is stored). The tattoo stencil mode is not
 * offered here: `mode` is passed through unchanged.
 */
import { Slider, Switch } from '../components/ui/index.ts';
import {
  snapStrokeWidth,
  STROKE_WIDTH_MAX,
  STROKE_WIDTH_MIN,
  STROKE_WIDTH_STEP,
  strokeWidthLevel,
} from '../features/sigil/index.ts';
import type { StyleOptions } from '../features/sigil/types.ts';
import type { AppStrings } from './strings.fr.ts';

/** Id of the stroke width slider. */
const STROKE_WIDTH_FIELD_ID = 'style-stroke-width';

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
  /** Texts of the section, in the interface language. */
  readonly strings: AppStrings['style'];
}

/**
 * Renders the three style controls.
 *
 * @returns The controls, stacked.
 */
export function StylePanel({ value, onChange, strings }: StylePanelProps) {
  const level = strokeWidthLevel(value.strokeWidth);

  return (
    <div className="style-panel">
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
    </div>
  );
}
