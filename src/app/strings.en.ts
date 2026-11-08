/**
 * Every text shown by the interface, in English: labels, help, error and
 * status messages, the accessible names, and the explanation panel.
 *
 * Exposes `STRINGS_EN`, typed as `AppStrings` so the compiler rejects a
 * missing or extra key against the French dictionary (`strings.fr.ts`).
 * Written as natural English rather than a word-for-word copy of the French.
 * Contains no logic beyond English grammar (plurals, articles); plurals and
 * decimals go through the shared formatting of `features/i18n`.
 */
import type {
  KameaExplanationStrings,
  SpareExplanationStrings,
} from '../features/explain/index.ts';
import type { ExportStrings } from '../features/export/index.ts';
import { countNoun, formatDecimal } from '../features/i18n/index.ts';
import type { LanguageToggleStrings } from '../features/i18n/index.ts';
import { MAX_INTENTION_LETTERS } from '../features/intention/index.ts';
import type { StrokeWidthLevel } from '../features/sigil/index.ts';
import type { Planet } from '../features/sigil/types.ts';
import type { AppStrings } from './strings.fr.ts';
import type { PrivacyNoteStrings } from './PrivacyNote.tsx';
import type { ThemeToggleStrings } from './ThemeToggle.tsx';

/** Planet names as shown on the picker. */
const PLANET_NAMES: Readonly<Record<Planet, string>> = {
  saturn: 'Saturn',
  jupiter: 'Jupiter',
  mars: 'Mars',
  sun: 'Sun',
  venus: 'Venus',
  mercury: 'Mercury',
  moon: 'Moon',
};

/** Planet names after "of", with the article English uses ("of the Sun", "of the Moon"). */
const PLANET_OF: Readonly<Record<Planet, string>> = {
  saturn: 'of Saturn',
  jupiter: 'of Jupiter',
  mars: 'of Mars',
  sun: 'of the Sun',
  venus: 'of Venus',
  mercury: 'of Mercury',
  moon: 'of the Moon',
};

/**
 * English plural of a counted noun.
 *
 * @param count - How many.
 * @param singular - Form for exactly 1.
 * @param plural - Form for every other count, zero included.
 * @returns `"<count> <noun>"`.
 */
function counted(count: number, singular: string, plural: string): string {
  return countNoun(count, { one: singular, other: plural }, 'en');
}

/**
 * Quotes characters with English curly quotes, separated by spaces.
 *
 * @param characters - Characters as typed.
 * @returns For instance `“1” “2”`.
 */
function quoted(characters: readonly string[]): string {
  return characters.map((character) => `“${character}”`).join(' ');
}

/** Words for the stroke width levels, next to the slider value. */
const STROKE_WIDTH_LEVELS: Readonly<Record<StrokeWidthLevel, string>> = {
  thin: 'thin',
  medium: 'medium',
  thick: 'thick',
};

/**
 * Writes a stroke width the English way, with a decimal point and one decimal.
 *
 * @param width - Width in frame units.
 * @returns For instance `"1.2"` or `"4.0"`.
 */
function strokeWidthNumber(width: number): string {
  return formatDecimal(width, 'en', 1);
}

/** Texts of the explanation panel for a kamea sigil. */
const KAMEA_EXPLANATION: KameaExplanationStrings = {
  planetOf: PLANET_OF,

  lettersTitle: 'Letters traced',
  lettersBody:
    'Accents are removed, everything is capitalised, and spaces and punctuation are dropped. The kamea method keeps every letter, even repeated ones.',
  lettersLabel: (count) => `${counted(count, 'letter', 'letters')}:`,

  ruleTitle: 'Conversion rule',
  ruleBody: (planetOf, cellCount) =>
    `Each letter takes its place in the alphabet (A = 1 … Z = 26). The square ${planetOf} has ${String(cellCount)} cells: after ${String(cellCount)}, counting starts again from 1.`,
  ruleFormula: (cellCount) => `number = ((rank − 1) mod ${String(cellCount)}) + 1`,
  ruleExample: (letter, rank, cellCount, number) =>
    `Example: ${letter}, rank ${String(rank)} → ((${String(rank)} − 1) mod ${String(cellCount)}) + 1 = ${String(number)}`,
  ruleNoWrap: (cellCount) =>
    `Each letter takes its place in the alphabet (A = 1 … Z = 26). The square has ${String(cellCount)} cells, more than the 26 letters, so every letter keeps its rank.`,
  rulePythagorean: 'On the square of Saturn, this rule is the Pythagorean reduction.',

  tableTitle: 'Letter → number',
  tableHeadings: { letter: 'Letter', rank: 'Rank', number: 'Cell' },
  tableLabel: 'Letter, rank and cell table',
  tableEntry: (letter, rank, number) => `${letter}: rank ${String(rank)}, cell ${String(number)}`,

  pathTitle: 'Path on the square',
  pathBody:
    'The path joins the cells in the order of the letters: a circle marks the start, a perpendicular bar the end.',
  pathSequenceLabel: 'Cells:',
  loopCount: (count) =>
    count === 1
      ? 'A loop marks a cell reached several times in a row.'
      : `${String(count)} loops mark cells reached several times in a row.`,
  gridLabel: (planetOf, order, numbers) =>
    `Square ${planetOf}, ${String(order)} × ${String(order)}, with the path: ${numbers.join(', ')}`,
};

/** Texts of the explanation panel for a Spare sigil. */
const SPARE_EXPLANATION: SpareExplanationStrings = {
  reductionTitle: 'Letters removed',
  reductionBody: (keepVowels) =>
    keepVowels
      ? 'Accents and punctuation are dropped, and every repeated letter is removed. The vowels stay, as requested.'
      : 'Accents and punctuation are dropped, every repeated letter is removed, then the vowels A, E, I, O, U. Y stays, as it often works as a consonant.',
  stripLabel: (count) => `The intention’s ${counted(count, 'letter', 'letters')}`,
  letterStatus: (reason) => {
    if (reason === 'duplicate') return ', removed: duplicate';
    if (reason === 'vowel') return ', removed: vowel';
    return ', kept';
  },
  duplicatesLabel: 'Duplicates:',
  vowelsLabel: 'Vowels:',
  keptLabel: 'Kept:',
  noneRemoved: 'none',

  skeletonsTitle: 'Angular skeletons',
  skeletonsBody:
    'Each kept letter is redrawn with straight strokes: each of its curves becomes two to four segments. The thin, faint line is the original letter; the bold line is its skeleton.',
  skeletonsLabel: 'Angular skeletons of the kept letters',
  segmentCount: (count) => counted(count, 'segment', 'segments'),

  attachmentsTitle: 'Hooking onto the stem',
  attachmentsBody:
    'A vertical line, the stem, runs through the sigil from top to bottom, and each letter hooks onto it: on the stem when its upright stroke merges with it, centred when the stem runs through its middle, hanging when it touches the stem at a single point.',
  attachmentsLabel: 'Letters on the stem, top to bottom',
  attachment: { stem: 'on the stem', centre: 'centred', tip: 'hanging' },
  mirrored: 'mirrored',
  doubled: 'doubled symmetrically',
  side: { left: 'on the left', right: 'on the right', both: 'on both sides' },
  runeLabel: (letterCount) =>
    letterCount === 1
      ? 'The stem in bold and the letter hooked onto it, before merging'
      : `The stem in bold and the ${counted(letterCount, 'letter', 'letters')} hooked onto it, before merging`,
  runeCaption: 'Stem in bold',

  choiceTitle: 'Choosing the variant',
  styleBody: {
    symmetric:
      'This variant is symmetric: every letter set on one side of the stem is doubled by its mirror image on the other side.',
    paired:
      'This variant is paired: no letter is doubled, and the letters that sit on one side face each other across the stem.',
    mixed:
      'This variant is mixed: some letters are doubled by their mirror image, others stay on one side of the stem.',
  },
  choiceBody: (number, count) =>
    `Of ${String(count)} runes drawn (always the same for this intention and variant), number ${String(number)} is kept: no parallel strokes side by side, taller than wide, not too much ink, and balanced on both sides of the stem.`,

  simplificationTitle: 'Simplification',
  simplificationBody: (before, after) => {
    const merged =
      'The stem and the letters share strokes: where they overlap, the shared part is drawn only once';
    if (after < before) {
      return `${merged}, so ${counted(before, 'segment', 'segments')} become ${String(after)}.`;
    }
    if (after === before) {
      return `${merged}; the sigil still has ${counted(before, 'segment', 'segments')}.`;
    }
    return `${merged}. A stroke covered only in part is cut around the shared part, so the count goes from ${String(before)} to ${counted(after, 'segment', 'segments')}.`;
  },
};

/** No-break space: a number never gets separated from its unit. */
const NBSP = ' ';

/**
 * Writes a length in millimetres the English way, with one decimal.
 *
 * @param millimetres - Length.
 * @returns For instance `"0.6 mm"`, with a no-break space before the unit.
 */
function millimetresText(millimetres: number): string {
  return `${formatDecimal(millimetres, 'en', 1)}${NBSP}mm`;
}

/**
 * Writes a length in centimetres the English way, decimals only when needed.
 *
 * @param centimetres - Length.
 * @returns For instance `"8 cm"` or `"6.5 cm"`, with a no-break space before the unit.
 */
function centimetresText(centimetres: number): string {
  const digits = Number.isInteger(centimetres) ? 0 : 1;
  return `${formatDecimal(centimetres, 'en', digits)}${NBSP}cm`;
}

/**
 * English indefinite article before a number written in digits, chosen by how
 * the number is said: "an" before eight, eleven, eighteen, eighty…, "a" otherwise.
 *
 * @param value - The number that follows; only its integer part is spoken
 *   first ("6.5" is "six point five"). Meant for values under 1,000.
 * @returns `"an"` or `"a"`.
 */
function articleBefore(value: number): 'a' | 'an' {
  const whole = Math.trunc(Math.abs(value));
  return String(whole).startsWith('8') || whole === 11 || whole === 18 ? 'an' : 'a';
}

/**
 * How readable a kamea sigil stays, said in the export dialog and in the
 * privacy note.
 */
const KAMEA_READABLE =
  'A kamea sigil can be read back by someone who knows the method: its letters can be recovered from the cells of the square. A Spare sigil is far less reversible.';

/** Texts of the "Export" button and dialog. */
const EXPORT: ExportStrings = {
  open: 'Export',
  title: 'Export the sigil',
  formatLegend: 'Format',
  formats: { svg: 'SVG', png: 'PNG', pdf: 'PDF' },
  formatHelp: {
    svg: 'Vector drawing, sharp at any size, for an editor or the web.',
    png: 'Square image, on the theme background (white in stencil mode).',
    pdf: 'Tattoo stencil on an A4 page: pure black on white, at actual size, with a 1 cm control ruler.',
  },
  resolutionLegend: 'Resolution',
  resolution: (pixels) => `${String(pixels)} px`,
  sizeLabel: 'Actual size (cm)',
  sizeHelp: 'Largest dimension of the printed sigil, from 1 to 25 cm.',
  sizeError: (error) =>
    error === 'not-a-number'
      ? 'Write a size in centimetres, for example 8 or 6.5.'
      : 'The size must be between 1 and 25 cm.',
  sizeTooLarge: (max) =>
    `Too large for an A4 page: on it, this sigil can be at most ${centimetresText(max)}.`,
  strokeLabel: 'Stroke width',
  strokeValue: millimetresText,
  strokeHelp: 'From 0.3 to 1.2 mm, kept when printed; 0.6 mm by default.',
  preview: (format) => `Preview of the ${format} file`,
  cancel: 'Cancel',
  download: 'Download',
  error: (format) =>
    `The ${format} export failed. Try again; if it keeps failing, try another browser.`,
  kameaReadable: KAMEA_READABLE,
  pdf: (centimetres, millimetres) => ({
    ruler: '1 cm',
    instruction: 'Print at 100%, with no scaling and no “fit to page”.',
    details: `Sigil: ${centimetresText(centimetres)} along its largest dimension, ${millimetresText(millimetres)} stroke.`,
  }),
};

/** Texts of the language selector; the language names match the French dictionary. */
const LANGUAGE: LanguageToggleStrings = {
  legend: 'Interface language',
  codes: { fr: 'FR', en: 'EN' },
  names: { fr: 'Français', en: 'English' },
};

/** Texts of the theme selector. */
const THEME: ThemeToggleStrings = {
  legend: 'Theme',
  names: { system: 'System', light: 'Ink on paper', dark: 'Gold on black' },
};

/** Texts of the privacy note opened from the footer. */
const PRIVACY: PrivacyNoteStrings = {
  open: 'Privacy',
  title: 'Privacy',
  nothingSent:
    'Everything happens in this browser. The intention is never sent anywhere or saved: not in the page address, not on the device, not in the name or metadata of exported files.',
  preferences:
    'Only two preferences stay on the device, in the browser’s local storage: the language and the theme.',
  hosting:
    'The site is hosted by GitHub Pages, which logs visitors’ IP addresses under its own privacy policy. The site itself transmits nothing and uses no cookies or analytics.',
  kameaReadable: KAMEA_READABLE,
  close: 'Close',
};

/** All English texts of the interface. */
export const STRINGS_EN: AppStrings = {
  appTitle: 'Sigil',
  pageDescription:
    'Deterministic sigil generator: kamea and Spare methods, drawn in SVG in your browser.',
  language: LANGUAGE,
  theme: THEME,
  privacy: PRIVACY,

  controls: {
    heading: 'Trace a sigil',
  },

  intention: {
    label: 'Intention',
    help: `A single word, ${String(MAX_INTENTION_LETTERS)} letters at most. It stays in this browser: nothing is sent or saved.`,
    letterCount: (count) => {
      if (count === 0) return 'No letters to trace yet';
      if (count > MAX_INTENTION_LETTERS) {
        return `${counted(count, 'letter', 'letters')}: ${String(count - MAX_INTENTION_LETTERS)} too many, ${String(MAX_INTENTION_LETTERS)} at most`;
      }
      return `${counted(count, 'letter', 'letters')} to trace`;
    },
  },

  method: {
    legend: 'Method',
    kamea: 'Kamea',
    spare: 'Spare',
  },

  spare: {
    keepVowels: 'Keep the vowels',
    keepVowelsHelp: 'By default, Spare removes the vowels A, E, I, O, U.',
    on: 'on',
    off: 'off',
    keepVowelsAndTrace: 'Keep the vowels and trace',
  },

  planet: {
    legend: 'Planetary square',
    names: PLANET_NAMES,
    size: (order) => `${String(order)}×${String(order)}`,
  },

  trace: 'Trace',
  replay: 'Replay',
  otherVariant: 'Another variant',
  export: EXPORT,
  replayStepwiseHint:
    'Reduced motion: each click on “Replay” draws one more step, without animation.',
  replayStep: (step, count) =>
    step >= count
      ? `Step by step: step ${String(step)} of ${String(count)}, sigil complete.`
      : `Step by step: step ${String(step)} of ${String(count)}.`,

  style: {
    title: 'Style',
    strokeWidth: 'Stroke width',
    strokeWidthValue: (width, level) =>
      `${STROKE_WIDTH_LEVELS[level]} · ${strokeWidthNumber(width)}`,
    strokeWidthSpoken: (width, level) =>
      `${strokeWidthNumber(width)}, ${STROKE_WIDTH_LEVELS[level]}`,
    strokeWidthHelp: 'From 0.4 to 2.4 on a 100-unit frame; 1.2 by default.',
    stencil: 'Tattoo stencil',
    stencilHelp: (printSizeCm) =>
      `Pure black on white, a single line, no framing circle. The width is in millimetres for ${articleBefore(printSizeCm)} ${centimetresText(printSizeCm)} print (size set in “Export”).`,
    strokeMmValue: millimetresText,
    strokeMmHelp: 'From 0.3 to 1.2 mm on paper; 0.6 mm by default.',
    roundEnds: 'Rounded ends',
    frameCircle: 'Framing circle',
    on: 'on',
    off: 'off',
  },

  stage: {
    heading: 'Sigil',
    empty: 'Write an intention, choose a square, then trace.',
    emptySpare: 'Write an intention, then trace.',
    error: 'Nothing to trace yet: the message under the field says what to change.',
    label: (planet) => `Kamea sigil ${PLANET_OF[planet]}`,
    traced: (letterCount, planet) =>
      `Sigil traced: ${counted(letterCount, 'letter', 'letters')} on the square ${PLANET_OF[planet]}.`,
    spareLabel: (variant) => `Spare sigil, variant ${String(variant)}`,
    spareTraced: (keptCount, variant) =>
      `Spare sigil traced: ${counted(keptCount, 'letter', 'letters')} kept, variant ${String(variant)}.`,
    variant: (variant) => `Variant ${String(variant)}`,
  },

  errors: {
    empty: `Write an intention before tracing, as a single word, for example ${quoted(['Calm'])}.`,
    noLatinLetter: (ignored) =>
      ignored.length === 0
        ? 'No Latin letters to trace. Write the intention with the letters A to Z (accents are fine).'
        : `No Latin letters to trace: ${quoted(ignored)} cannot be traced. Write the intention with the letters A to Z (accents are fine).`,
    multipleWords: `One word only, without spaces: beyond one word, the sigil becomes unreadable. Keep the word that carries your intention, for example ${quoted(['Calm'])}.`,
    tooLong: (letterCount, maxLetters) =>
      `This word gives ${counted(letterCount, 'letter', 'letters')}, ${String(maxLetters)} at most: beyond that, the sigil becomes unreadable. Choose a shorter word.`,
    tooFewLetters: 'A single letter makes no path. Write at least two letters.',
    singleCell: (number, planet) =>
      `Every letter lands on cell ${String(number)} of the square ${PLANET_OF[planet]}: the trace would be a single dot. Choose another square or add letters.`,
    onlyVowels:
      'Without its vowels, this intention leaves no letters: Spare removes duplicates and vowels. Keep the vowels to trace it.',
    noLetterLeft:
      'No letters are left once the duplicates are removed. Change the intention and trace again.',
    invalidLetter:
      'A character could not be turned into a number. Change the intention and trace again.',
  },

  ignoredWarning: (ignored) =>
    `Ignored characters: ${quoted(ignored)}. Only the letters A to Z are traced.`,

  explain: {
    title: 'How it’s made',
    empty: 'Each step of the calculation will appear here once the sigil is traced.',
    kamea: KAMEA_EXPLANATION,
    spare: SPARE_EXPLANATION,
  },
};
