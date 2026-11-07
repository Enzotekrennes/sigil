/**
 * Choice of the planetary square for the kamea method: the seven planets of
 * Agrippa, each shown with the size of its square ("Saturne · 3×3").
 *
 * Exposes `PlanetPicker`, a thin binding of the generic `ChoiceCards` to the
 * kamea data; the planet order and square sizes come from `features/kamea`.
 */
import { ChoiceCards } from '../components/ui/index.ts';
import type { ChoiceCard } from '../components/ui/index.ts';
import { KAMEA_SQUARES, PLANETS } from '../features/kamea/index.ts';
import type { Planet } from '../features/sigil/types.ts';
import type { AppStrings } from './strings.fr.ts';

/** Props of `PlanetPicker`. */
export interface PlanetPickerProps {
  /** Selected planet. */
  readonly value: Planet;
  /** Called with the planet the user selects. */
  readonly onChange: (planet: Planet) => void;
  /** Texts of the picker in the interface language. */
  readonly strings: AppStrings['planet'];
}

/**
 * Renders the seven planets, smallest square first.
 *
 * @returns The radio group.
 */
export function PlanetPicker({ value, onChange, strings }: PlanetPickerProps) {
  const options: ChoiceCard<Planet>[] = PLANETS.map((planet) => ({
    value: planet,
    label: strings.names[planet],
    detail: strings.size(KAMEA_SQUARES[planet].length),
  }));

  return (
    <ChoiceCards
      legend={strings.legend}
      name="planet"
      options={options}
      value={value}
      onChange={onChange}
    />
  );
}
