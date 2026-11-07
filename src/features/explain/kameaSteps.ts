/**
 * Reading helpers over the explanation steps of a kamea sigil: picks each
 * step out of `Sigil.steps`, chooses the letter used to illustrate the
 * conversion rule, and places the square on the sigil's frame.
 *
 * Pure functions, no rendering. Does not recompute anything the kamea method
 * already produced: numbers, cells and path all come from the sigil.
 */
import type {
  ExplanationStep,
  GridCell,
  KameaConversionRuleStep,
  KameaLetterEntry,
  KameaLetterTableStep,
  KameaSquarePathStep,
  Point,
} from '../sigil/types.ts';

/**
 * Offset of the square inside the 0–100 frame of a kamea sigil. Must match
 * `GRID_MARGIN` in `features/kamea/buildKameaSigil.ts`; the unit tests check
 * that the cell centres computed here fall on the sigil's path.
 */
export const KAMEA_GRID_MARGIN = 10;

/** Side of the square inside the frame: the frame (100) minus both margins. */
export const KAMEA_GRID_SIZE = 100 - 2 * KAMEA_GRID_MARGIN;

/** Number of letters in the Latin alphabet: squares this large never wrap. */
const ALPHABET_LENGTH = 26;

/** The three steps a kamea sigil carries, ready for display. */
export interface KameaSteps {
  readonly rule: KameaConversionRuleStep;
  readonly table: KameaLetterTableStep;
  readonly path: KameaSquarePathStep;
}

/**
 * Picks the kamea steps out of a sigil's explanation.
 *
 * @param steps - `Sigil.steps` of any method.
 * @returns The three kamea steps, or `undefined` when one is missing (the
 *   sigil was not drawn by the kamea method).
 */
export function readKameaSteps(steps: readonly ExplanationStep[]): KameaSteps | undefined {
  let rule: KameaConversionRuleStep | undefined;
  let table: KameaLetterTableStep | undefined;
  let path: KameaSquarePathStep | undefined;
  for (const step of steps) {
    if (step.kind === 'kamea-conversion-rule') rule = step;
    else if (step.kind === 'kamea-letter-table') table = step;
    else if (step.kind === 'kamea-square-path') path = step;
  }
  if (rule === undefined || table === undefined || path === undefined) return undefined;
  return { rule, table, path };
}

/**
 * Chooses the letter that best illustrates the conversion rule: the first one
 * whose rank goes past the square's last cell (so the wrap is visible), or
 * else the first letter.
 *
 * @param entries - Letter table, in intention order.
 * @param cellCount - Number of cells N² of the square.
 * @returns The entry to work through, or `undefined` for an empty table.
 */
export function conversionExample(
  entries: readonly KameaLetterEntry[],
  cellCount: number,
): KameaLetterEntry | undefined {
  return entries.find((entry) => entry.rank > cellCount) ?? entries[0];
}

/**
 * Whether the conversion can wrap on this square: false from 26 cells up,
 * where every letter keeps its rank.
 *
 * @param cellCount - Number of cells N² of the square.
 * @returns True when some letter rank exceeds the last cell.
 */
export function ruleWraps(cellCount: number): boolean {
  return cellCount < ALPHABET_LENGTH;
}

/**
 * Side of one cell of an N × N square in frame units.
 *
 * @param order - Side N of the square.
 * @returns The cell size.
 */
export function cellSize(order: number): number {
  return KAMEA_GRID_SIZE / order;
}

/**
 * Centre of a cell in the sigil's 0–100 frame, where the path passes.
 *
 * @param cell - Zero-based cell.
 * @param order - Side N of the square.
 * @returns The centre in frame units.
 */
export function gridCellCenter(cell: GridCell, order: number): Point {
  const size = cellSize(order);
  return {
    x: KAMEA_GRID_MARGIN + (cell.column + 0.5) * size,
    y: KAMEA_GRID_MARGIN + (cell.row + 0.5) * size,
  };
}
