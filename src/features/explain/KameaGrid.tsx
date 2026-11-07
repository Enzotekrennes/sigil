/**
 * Draws the planet's square with its numbers and, on top, the very path and
 * marks of the sigil: the reader sees which cells the line joins.
 *
 * Exposes `KameaGrid`. Static drawing (no tracing animation), in the sigil's
 * own 0–100 frame so the path needs no transformation. Visited cells are
 * tinted; numbers sit in the top-left corner of their cell, drawn last on a
 * small plate of their cell colour (plus a halo), so a path crossing a number
 * passes under it: the number stays readable and the path shows on both
 * sides of it. Colours come from the
 * tokens through `KameaExplanation.css`.
 */
import { endBarEndpoints, formatCoordinate, polylinePathData, scaleMark } from '../sigil/index.ts';
import type { GridCell, Mark, Point, Sigil } from '../sigil/types.ts';
import { cellSize, KAMEA_GRID_MARGIN, KAMEA_GRID_SIZE } from './kameaSteps.ts';

/**
 * Stroke width of the path on the grid, in frame units: half the sigil's
 * default (1.2), so the numbers under it stay the main information.
 */
const GRID_PATH_WIDTH = 0.6;

/** Width of the grid lines in frame units: a hairline at panel size. */
const GRID_LINE_WIDTH = 0.25;

/**
 * Number height as a share of the cell side. Numbers sit in the top-left
 * corner of their cell so the path, which runs through the cell centres, and
 * its marks stay visible; 0.34 keeps the 9 × 9 digits at about 12 px on a
 * 375 px screen.
 */
const NUMBER_SIZE_RATIO = 0.34;

/**
 * Largest number height in frame units, so the 3 × 3 square does not show
 * poster-sized digits (about 20 px in a 360 px panel).
 */
const NUMBER_SIZE_MAX = 4.5;

/** Gap between a number and the corner of its cell, as a share of the cell side. */
const NUMBER_INSET_RATIO = 0.08;

/** Halo around each number as a share of its height, so a crossing path reads as passing under it. */
const NUMBER_HALO_RATIO = 0.3;

/**
 * Advance of one digit as a share of the font size: IBM Plex Mono, like
 * every monospace of the fallback stack, sets each digit 0.6 em wide.
 */
const DIGIT_ADVANCE_RATIO = 0.6;

/**
 * Height of the plate behind a number as a share of its font size: the digits'
 * box from the top edge of the em (where `text-before-edge` puts it) down to
 * the baseline and a little below.
 */
const NUMBER_PLATE_HEIGHT_RATIO = 1;

/**
 * Margin of the plate around the number, as a share of the cell side: smaller
 * than the number's inset (0.08) so the plate never covers the grid lines.
 */
const NUMBER_PLATE_PADDING_RATIO = 0.05;

/** Margin kept around the square for the marks that stick out of the edge cells. */
const VIEW_MARGIN = 1;

/** Props of `KameaGrid`. */
export interface KameaGridProps {
  /** Sigil drawn by the kamea method; its first stroke is the path. */
  readonly sigil: Sigil;
  /** Square values, row by row from the top (from the `kamea-square-path` step). */
  readonly square: readonly (readonly number[])[];
  /** Cells visited by the path (from the same step). */
  readonly cells: readonly GridCell[];
  /** Accessible name of the drawing: planet, size and the numbers visited. */
  readonly label: string;
}

/**
 * Renders the square, the visited cells, the path and its marks.
 *
 * @returns An `<svg role="img">` labelled by `label`.
 */
export function KameaGrid({ sigil, square, cells, label }: KameaGridProps) {
  const order = square.length;
  const size = cellSize(order);
  const numberSize = Math.min(size * NUMBER_SIZE_RATIO, NUMBER_SIZE_MAX);
  const visited = new Set(cells.map((cell) => cellKey(cell)));
  const marks = sigil.marks.map((mark) => scaleMark(mark, GRID_PATH_WIDTH));
  const viewOrigin = KAMEA_GRID_MARGIN - VIEW_MARGIN;
  const viewSize = KAMEA_GRID_SIZE + 2 * VIEW_MARGIN;
  const lineOffsets = Array.from(
    { length: order + 1 },
    (_, index) => KAMEA_GRID_MARGIN + index * size,
  );

  return (
    <svg
      className="kamea-grid"
      viewBox={`${String(viewOrigin)} ${String(viewOrigin)} ${String(viewSize)} ${String(viewSize)}`}
      role="img"
      aria-label={label}
    >
      <rect
        className="kamea-grid__background"
        x={KAMEA_GRID_MARGIN}
        y={KAMEA_GRID_MARGIN}
        width={KAMEA_GRID_SIZE}
        height={KAMEA_GRID_SIZE}
      />
      {square.flatMap((values, row) =>
        values.map((_, column) =>
          visited.has(cellKey({ row, column })) ? (
            <rect
              key={cellKey({ row, column })}
              className="kamea-grid__cell--visited"
              x={formatCoordinate(KAMEA_GRID_MARGIN + column * size)}
              y={formatCoordinate(KAMEA_GRID_MARGIN + row * size)}
              width={formatCoordinate(size)}
              height={formatCoordinate(size)}
            />
          ) : null,
        ),
      )}
      <g className="kamea-grid__lines" strokeWidth={GRID_LINE_WIDTH}>
        {lineOffsets.map((offset) => (
          <g key={offset}>
            <line
              x1={formatCoordinate(offset)}
              y1={KAMEA_GRID_MARGIN}
              x2={formatCoordinate(offset)}
              y2={KAMEA_GRID_MARGIN + KAMEA_GRID_SIZE}
            />
            <line
              x1={KAMEA_GRID_MARGIN}
              y1={formatCoordinate(offset)}
              x2={KAMEA_GRID_MARGIN + KAMEA_GRID_SIZE}
              y2={formatCoordinate(offset)}
            />
          </g>
        ))}
      </g>
      <g
        className="kamea-grid__path"
        fill="none"
        strokeWidth={GRID_PATH_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {sigil.strokes.map((stroke, index) => (
          // Strokes never reorder, so the index is a stable key.
          <path key={index} d={polylinePathData(stroke)} />
        ))}
        {marks.map((mark, index) => renderMark(mark, index))}
      </g>
      <g className="kamea-grid__numbers" fontSize={formatCoordinate(numberSize)}>
        {square.flatMap((values, row) =>
          values.flatMap((value, column) => {
            const corner: Point = {
              x: KAMEA_GRID_MARGIN + column * size + size * NUMBER_INSET_RATIO,
              y: KAMEA_GRID_MARGIN + row * size + size * NUMBER_INSET_RATIO,
            };
            const isVisited = visited.has(cellKey({ row, column }));
            const padding = size * NUMBER_PLATE_PADDING_RATIO;
            return [
              <rect
                key={`plate-${String(value)}`}
                className={
                  isVisited ? 'kamea-grid__plate kamea-grid__plate--visited' : 'kamea-grid__plate'
                }
                x={formatCoordinate(corner.x - padding)}
                y={formatCoordinate(corner.y - padding)}
                width={formatCoordinate(
                  String(value).length * numberSize * DIGIT_ADVANCE_RATIO + 2 * padding,
                )}
                height={formatCoordinate(numberSize * NUMBER_PLATE_HEIGHT_RATIO + 2 * padding)}
              />,
              <text
                key={value}
                className={
                  isVisited
                    ? 'kamea-grid__number kamea-grid__number--visited'
                    : 'kamea-grid__number'
                }
                x={formatCoordinate(corner.x)}
                y={formatCoordinate(corner.y)}
                strokeWidth={formatCoordinate(numberSize * NUMBER_HALO_RATIO)}
              >
                {value}
              </text>,
            ];
          }),
        )}
      </g>
    </svg>
  );
}

/**
 * Stable string key of a cell.
 *
 * @param cell - Zero-based cell.
 * @returns `"row:column"`.
 */
function cellKey(cell: GridCell): string {
  return `${String(cell.row)}:${String(cell.column)}`;
}

/**
 * Draws one mark of the path, already resized to the grid's stroke width.
 *
 * @param mark - Mark to draw.
 * @param index - Position among the marks, used as React key.
 * @returns A `<line>` for the end bar, a `<circle>` otherwise.
 */
function renderMark(mark: Mark, index: number) {
  if (mark.kind === 'end-bar') {
    const [from, to] = endBarEndpoints(mark, mark.length);
    return (
      <line
        key={index}
        data-mark={mark.kind}
        x1={formatCoordinate(from.x)}
        y1={formatCoordinate(from.y)}
        x2={formatCoordinate(to.x)}
        y2={formatCoordinate(to.y)}
      />
    );
  }
  return (
    <circle
      key={index}
      data-mark={mark.kind}
      cx={formatCoordinate(mark.center.x)}
      cy={formatCoordinate(mark.center.y)}
      r={formatCoordinate(mark.radius)}
    />
  );
}
