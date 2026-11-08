/**
 * Composition of a Spare sigil as a bind rune (plan decision D19): a vertical
 * stem, and the angular skeleton of each retained letter (D20) hooked onto
 * it, one below the other. A letter with a vertical stroke lays it on the
 * stem; a letter without one is centred on the stem (an O becomes a diamond
 * threaded on it) or hangs from it by its single outermost corner (the point
 * of a C). Letters may be flipped left to right, two letters may share a
 * height on either side of the stem, and a letter may be doubled by its
 * mirror image on the other side, which makes the rune symmetric.
 *
 * Exposes `composeBindRune`, `attachmentsOf` and the drawing constants.
 * Works in rune units: the stem is the line x = 0, y grows downwards and a
 * letter at full size is 1 unit high. Pure and deterministic for a given
 * generator state. Does not fit the rune into the frame, merge strokes or score.
 */
import type { RandomSource } from '../../lib/random.ts';
import { randomBetween } from '../../lib/random.ts';
import type { Point, SpareRuneStyle } from '../sigil/types.ts';
import { getAngularGlyph } from './angular.ts';
import type { CapitalLetter } from './glyphs/index.ts';

/** Height of a capital in the glyph frame, mapped to 1 rune unit. */
const CAP_HEIGHT = 21;

/** Distance under which two coordinates count as equal, in rune units. */
const SAME_COORDINATE = 1e-6;

/**
 * Shortest vertical stroke, as a share of the cap height, that a letter can
 * lay on the stem. Every stem of B D E F H I K L M N P R T U and the J reaches
 * the share; the half stem of Y (0.52) does too, so the Y forks off the stem.
 */
export const MIN_STEM_SHARE = 0.4;

/** Smallest and largest letter size, in rune units (1 = full cap height). */
export const MIN_LETTER_SCALE = 0.75;
export const MAX_LETTER_SCALE = 1;

/**
 * Chances, per layout style, that a one-sided letter starting a new level is
 * doubled by its mirror image (`doubling`), and that a one-sided letter
 * joins the level of the previous one on the other side of the stem when
 * that level holds a single undoubled one-sided letter (`pairing`). Doubling
 * makes the rune symmetric, as most reference runes are; pairing packs long
 * words into fewer levels, so that the rune stays a few letters high instead
 * of a thin pole, and gives the asymmetric runes of the references (Love,
 * Strength). `mixed` lets both compete letter by letter.
 */
export const STYLE_CHANCES: Readonly<Record<SpareRuneStyle, StyleChances>> = {
  symmetric: { doubling: 1, pairing: 0, firstUndoubled: false },
  paired: { doubling: 0, pairing: 0.8, firstUndoubled: false },
  mixed: { doubling: 0.4, pairing: 0.7, firstUndoubled: true },
};

/** Chances of a layout style (see `STYLE_CHANCES`). */
export interface StyleChances {
  /** Chance that a one-sided letter starting a level is doubled. */
  readonly doubling: number;
  /** Chance that a one-sided letter joins the previous single letter's level. */
  readonly pairing: number;
  /**
   * Never double the first one-sided letter, so that a mixed rune always
   * keeps one letter on one side only and differs from the symmetric one.
   */
  readonly firstUndoubled: boolean;
}

/** Chance that a letter without a vertical stroke hangs by its point rather than being centred. */
export const TIP_PROBABILITY = 0.3;

/**
 * Vertical gap between two levels, in rune units: negative values make
 * consecutive letters overlap on the stem (as in the reference runes, where
 * a diamond sits between two pairs of branches), positive ones leave a bare
 * length of stem between them.
 */
export const MIN_LEVEL_GAP = -0.2;
export const MAX_LEVEL_GAP = 0.15;

/** Largest downward shift of the second letter of a paired level, in rune units. */
export const MAX_PAIR_SHIFT = 0.25;

/** Length of bare stem added above the top letter and below the bottom one, in rune units. */
export const MIN_STEM_EXTENSION = 0.1;
export const MAX_STEM_EXTENSION = 0.5;

/**
 * Smallest height-to-width ratio of a rune. Below it, the stem is lengthened
 * at both ends: the reference runes are taller than wide, and a stem that
 * reaches beyond the letters is what makes them read as one sign.
 */
export const MIN_ASPECT_RATIO = 1.25;

/**
 * Height-to-width ratio above which a rune is widened. A long word hangs
 * four or five levels of letters about one unit high each but barely more
 * than one unit wide, a pole three times as high as wide once fitted: its
 * letters end up small and cramped. Widening it gives the letters room.
 */
export const STRETCH_FROM_ASPECT_RATIO = 2.2;

/**
 * Largest horizontal stretch of a rune: letters drawn 35 % wider keep their
 * shape (diamonds, chevrons and bars stay what they are), more would flatten them.
 */
export const MAX_STRETCH = 1.35;

/** How a letter is hooked onto the stem. */
export type Attachment =
  /** One of its vertical strokes lies on the stem. */
  | 'stem'
  /** Its bounding box is centred on the stem, which crosses it. */
  | 'centre'
  /** Its single outermost corner touches the stem. */
  | 'tip';

/** Which side of the stem a placed letter occupies. */
export type RuneSide = 'left' | 'right' | 'both';

/** One way of hooking a letter onto the stem, before mirroring. */
export interface AttachmentOption {
  readonly attachment: Attachment;
  /** Glyph x (Hershey units) put on the stem. */
  readonly anchorX: number;
}

/** A letter of the rune, as placed. */
export interface RuneLetter {
  /** The letter, A–Z: one of the retained letters, each placed once. */
  readonly letter: CapitalLetter;
  /** How the letter is hooked onto the stem. */
  readonly attachment: Attachment;
  /** Flipped left to right around the stem. */
  readonly mirrored: boolean;
  /** Drawn a second time, flipped, on the other side of the stem. */
  readonly doubled: boolean;
  /** Letter height in rune units, `MIN_LETTER_SCALE`–`MAX_LETTER_SCALE`. */
  readonly scale: number;
  /** y of the letter's cap line, in rune units. */
  readonly top: number;
  /** Side of the stem the letter (with its double) occupies. */
  readonly side: RuneSide;
}

/** A bind rune in rune units. */
export interface RuneComposition {
  /** Ends of the stem, on x = 0, top first. */
  readonly stem: { readonly top: number; readonly bottom: number };
  /** Letters in the order given, each with its placement. */
  readonly letters: readonly RuneLetter[];
  /** The stem first, then each letter's strokes (and its double's), in letter order. */
  readonly strokes: readonly (readonly Point[])[];
  /** For each stroke, the index in `letters` it belongs to; −1 for the stem. */
  readonly strokeLetters: readonly number[];
}

/**
 * The ways a letter can be hooked onto the stem: on each distinct vertical
 * stroke at least `MIN_STEM_SHARE` long, when it has one; otherwise centred,
 * and by its leftmost or rightmost corner when that corner is a single point.
 *
 * @param letter - Upper-case letter A–Z.
 * @returns At least one option, `stem` options first, from left to right.
 */
export function attachmentsOf(letter: CapitalLetter): AttachmentOption[] {
  const { strokes, bounds } = getAngularGlyph(letter);
  const stems = new Set<number>();
  for (const stroke of strokes) {
    for (let index = 1; index < stroke.length; index += 1) {
      const start = stroke[index - 1];
      const end = stroke[index];
      if (start === undefined || end === undefined) continue;
      const isVertical = Math.abs(start.x - end.x) < SAME_COORDINATE;
      if (isVertical && Math.abs(end.y - start.y) >= MIN_STEM_SHARE * CAP_HEIGHT) {
        stems.add(start.x);
      }
    }
  }
  if (stems.size > 0) {
    return [...stems]
      .sort((a, b) => a - b)
      .map((anchorX) => ({ attachment: 'stem' as const, anchorX }));
  }
  const options: AttachmentOption[] = [
    { attachment: 'centre', anchorX: bounds.x + bounds.width / 2 },
  ];
  const points = strokes.flat();
  for (const edge of [bounds.x, bounds.x + bounds.width]) {
    const onEdge = points.filter((point) => Math.abs(point.x - edge) < SAME_COORDINATE);
    const distinctYs = new Set(onEdge.map((point) => point.y));
    if (distinctYs.size === 1) options.push({ attachment: 'tip', anchorX: edge });
  }
  return options;
}

/** A letter being laid out, before its level is positioned. */
interface Draft {
  readonly index: number;
  readonly letter: CapitalLetter;
  readonly option: AttachmentOption;
  mirrored: boolean;
  doubled: boolean;
  readonly scale: number;
  /** Vertical shift inside its level, in rune units. */
  shift: number;
}

/**
 * Composes one bind rune from the letters, drawing every free choice from
 * the generator: how each letter is hooked, its size, its mirror, whether it
 * is doubled or paired with the next one, the gaps between levels and the
 * bare stem at both ends. A rune higher than `STRETCH_FROM_ASPECT_RATIO`
 * times its width is then widened, by `MAX_STRETCH` at most.
 *
 * @param letters - Distinct upper-case letters, in the order they are hung
 *   from top to bottom.
 * @param random - Generator advanced by every draw.
 * @param style - Layout the variant asks for (see `STYLE_CHANCES`).
 * @returns The rune in rune units: the stem covers every letter and reaches
 *   beyond the top and bottom ones; the whole is at least `MIN_ASPECT_RATIO`
 *   times as high as wide. Every letter touches or crosses the stem.
 */
export function composeBindRune(
  letters: readonly CapitalLetter[],
  random: RandomSource,
  style: SpareRuneStyle,
): RuneComposition {
  const drafts = letters.map((letter, index) => draftLetter(letter, index, random));
  const levels = groupIntoLevels(drafts, random, STYLE_CHANCES[style]);

  const placed: { draft: Draft; top: number; side: RuneSide; strokes: Point[][] }[] = [];
  let cursor = 0;
  for (const level of levels) {
    const height = Math.max(...level.map((draft) => draft.scale + draft.shift));
    for (const draft of level) {
      const top = cursor + draft.shift;
      const strokes = placeLetter(draft, top);
      placed.push({ draft, top, side: sideOf(strokes), strokes });
    }
    cursor += height + randomBetween(random, MIN_LEVEL_GAP, MAX_LEVEL_GAP);
  }

  const points = placed.flatMap((letter) => letter.strokes.flat());
  const ys = points.map((point) => point.y);
  const width = Math.max(...points.map((point) => Math.abs(point.x))) * 2;
  let top = Math.min(...ys) - randomBetween(random, MIN_STEM_EXTENSION, MAX_STEM_EXTENSION);
  let bottom = Math.max(...ys) + randomBetween(random, MIN_STEM_EXTENSION, MAX_STEM_EXTENSION);
  const missing = MIN_ASPECT_RATIO * width - (bottom - top);
  if (missing > 0) {
    top -= missing / 2;
    bottom += missing / 2;
  }
  const stretch = Math.min(
    MAX_STRETCH,
    Math.max(1, (bottom - top) / width / STRETCH_FROM_ASPECT_RATIO),
  );
  for (const letter of placed) {
    letter.strokes = letter.strokes.map((stroke) =>
      stroke.map((point) => ({ x: point.x * stretch, y: point.y })),
    );
  }

  placed.sort((a, b) => a.draft.index - b.draft.index);
  const strokes: Point[][] = [
    [
      { x: 0, y: top },
      { x: 0, y: bottom },
    ],
  ];
  const strokeLetters = [-1];
  for (const letter of placed) {
    for (const stroke of letter.strokes) {
      strokes.push(stroke);
      strokeLetters.push(letter.draft.index);
    }
  }
  return {
    stem: { top, bottom },
    letters: placed.map(({ draft, top: letterTop, side }) => ({
      letter: draft.letter,
      attachment: draft.option.attachment,
      mirrored: draft.mirrored,
      doubled: draft.doubled,
      scale: draft.scale,
      top: letterTop,
      side,
    })),
    strokes,
    strokeLetters,
  };
}

/**
 * Draws a letter's own choices: attachment option, size, mirror.
 *
 * @param letter - The letter.
 * @param index - Its position in the composed letters.
 * @param random - Generator advanced by the draws.
 * @returns The draft, undoubled and unshifted.
 */
function draftLetter(letter: CapitalLetter, index: number, random: RandomSource): Draft {
  const options = attachmentsOf(letter);
  const centred = options.find((option) => option.attachment === 'centre');
  const tips = options.filter((option) => option.attachment === 'tip');
  let option: AttachmentOption;
  if (centred !== undefined && (tips.length === 0 || random() >= TIP_PROBABILITY)) {
    option = centred;
  } else {
    const choices = centred === undefined ? options : tips;
    option = choices[Math.floor(random() * choices.length)] ??
      options[0] ??
      centred ?? {
        attachment: 'centre',
        anchorX: 0,
      };
  }
  return {
    index,
    letter,
    option,
    mirrored: random() < 0.5,
    doubled: false,
    scale: randomBetween(random, MIN_LETTER_SCALE, MAX_LETTER_SCALE),
    shift: 0,
  };
}

/**
 * Groups drafts into levels, top to bottom: a one-sided letter may join the
 * previous level on the other side of the stem (the style's `pairing` chance), or
 * start its own level and be doubled (its `doubling` chance). Letters
 * spreading on both sides always have a level of their own.
 *
 * @param drafts - Letters in order.
 * @param random - Generator advanced by the draws.
 * @param chances - Doubling and pairing chances of the layout style.
 * @returns The levels; drafts are updated in place (mirror, doubling, shift).
 */
function groupIntoLevels(
  drafts: readonly Draft[],
  random: RandomSource,
  chances: StyleChances,
): Draft[][] {
  const levels: Draft[][] = [];
  let seenOneSided = false;
  for (const draft of drafts) {
    const oneSided = isOneSided(draft);
    const previous = levels[levels.length - 1];
    const partner = previous?.length === 1 ? previous[0] : undefined;
    if (
      oneSided &&
      previous !== undefined &&
      partner !== undefined &&
      isOneSided(partner) &&
      !partner.doubled &&
      random() < chances.pairing
    ) {
      draft.mirrored =
        sideOf(placeLetter(partner, 0)) === sideOf(placeLetter(draft, 0))
          ? !draft.mirrored
          : draft.mirrored;
      draft.shift = randomBetween(random, 0, MAX_PAIR_SHIFT);
      previous.push(draft);
      continue;
    }
    if (oneSided) {
      const keepsSingle = chances.firstUndoubled && !seenOneSided;
      draft.doubled = !keepsSingle && random() < chances.doubling;
      seenOneSided = true;
    }
    levels.push([draft]);
  }
  return levels;
}

/**
 * Whether a draft, undoubled, lies on one side of the stem only.
 *
 * @param draft - Letter being laid out.
 * @returns True when all its strokes are on one side (the stem itself included).
 */
function isOneSided(draft: Draft): boolean {
  return sideOf(placeLetter({ ...draft, doubled: false }, 0)) !== 'both';
}

/**
 * Places a letter's angular skeleton on the stem.
 *
 * @param draft - Letter, attachment, mirror, doubling and size.
 * @param top - y of its cap line, in rune units.
 * @returns Its strokes in rune units, followed by its double's when doubled.
 */
function placeLetter(draft: Draft, top: number): Point[][] {
  // Jointed strokes: each joint is a shared point, so it survives every later step.
  const strokes = getAngularGlyph(draft.letter).jointedStrokes;
  const unit = draft.scale / CAP_HEIGHT;
  const flip = draft.mirrored ? -1 : 1;
  const placed = strokes.map((stroke) =>
    stroke.map((point) => ({
      x: flip * (point.x - draft.option.anchorX) * unit + 0,
      y: top + (point.y + CAP_HEIGHT) * unit,
    })),
  );
  if (!draft.doubled) return placed;
  return [
    ...placed,
    ...placed.map((stroke) => stroke.map((point) => ({ x: -point.x + 0, y: point.y }))),
  ];
}

/**
 * Side of the stem some strokes occupy.
 *
 * @param strokes - Strokes in rune units.
 * @returns `left` or `right` when every point is on that side or on the
 *   stem, `both` otherwise.
 */
function sideOf(strokes: readonly (readonly Point[])[]): RuneSide {
  const xs = strokes.flat().map((point) => point.x);
  if (Math.max(...xs) <= SAME_COORDINATE) return 'left';
  if (Math.min(...xs) >= -SAME_COORDINATE) return 'right';
  return 'both';
}
