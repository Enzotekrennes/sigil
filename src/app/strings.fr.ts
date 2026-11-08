/**
 * Every text shown by the interface, in French: labels, help, error and
 * status messages, the accessible names, and the explanation panel.
 *
 * Exposes `STRINGS_FR` and its type `AppStrings`, the shape the English
 * dictionary (`strings.en.ts`) must satisfy key for key. Texts that depend on
 * a value are functions of that value. Contains no logic beyond French
 * grammar (plurals, elision); plurals and decimals go through the shared
 * formatting of `features/i18n`.
 */
import type {
  KameaExplanationStrings,
  SpareExplanationStrings,
} from '../features/explain/index.ts';
import type { ExportStrings } from '../features/export/index.ts';
import { countNoun, formatDecimal } from '../features/i18n/index.ts';
import type { LanguageToggleStrings } from '../features/i18n/index.ts';
import type { StrokeWidthLevel } from '../features/sigil/index.ts';
import type { Planet } from '../features/sigil/types.ts';
import type { PrivacyNoteStrings } from './PrivacyNote.tsx';
import type { ThemeToggleStrings } from './ThemeToggle.tsx';

/** Planet names as shown on the picker. */
const PLANET_NAMES: Readonly<Record<Planet, string>> = {
  saturn: 'Saturne',
  jupiter: 'Jupiter',
  mars: 'Mars',
  sun: 'Soleil',
  venus: 'Vénus',
  mercury: 'Mercure',
  moon: 'Lune',
};

/** Planet names with the French "de" + article ("du Soleil", "de la Lune"). */
const PLANET_OF: Readonly<Record<Planet, string>> = {
  saturn: 'de Saturne',
  jupiter: 'de Jupiter',
  mars: 'de Mars',
  sun: 'du Soleil',
  venus: 'de Vénus',
  mercury: 'de Mercure',
  moon: 'de la Lune',
};

/**
 * French plural of a counted noun.
 *
 * @param count - How many.
 * @param singular - Form for 0 and 1 (French uses the singular for zero).
 * @param plural - Form from 2 up.
 * @returns `"<count> <noun>"`.
 */
function counted(count: number, singular: string, plural: string): string {
  return countNoun(count, { one: singular, other: plural }, 'fr');
}

/** No-break space: French guillemets never get separated from what they quote. */
const NBSP = '\u00a0';

/**
 * Quotes characters with French guillemets, separated by spaces.
 *
 * @param characters - Characters as typed.
 * @returns For instance `« 1 » « 2 »`, with no-break spaces inside the guillemets.
 */
function quoted(characters: readonly string[]): string {
  return characters.map((character) => `«${NBSP}${character}${NBSP}»`).join(' ');
}

/** Words for the stroke width levels, next to the slider value. */
const STROKE_WIDTH_LEVELS: Readonly<Record<StrokeWidthLevel, string>> = {
  thin: 'fin',
  medium: 'moyen',
  thick: 'épais',
};

/**
 * Writes a stroke width the French way, with a decimal comma and one decimal.
 *
 * @param width - Width in frame units.
 * @returns For instance `"1,2"` or `"4,0"`.
 */
function strokeWidthNumber(width: number): string {
  return formatDecimal(width, 'fr', 1);
}

/** Texts of the explanation panel for a kamea sigil. */
const KAMEA_EXPLANATION: KameaExplanationStrings = {
  planetOf: PLANET_OF,

  lettersTitle: 'Lettres tracées',
  lettersBody:
    'Accents retirés, majuscules, espaces et ponctuation ôtés. La méthode kamea garde chaque lettre, même répétée.',
  lettersLabel: (count) => `${counted(count, 'lettre', 'lettres')} :`,

  ruleTitle: 'Règle de conversion',
  ruleBody: (planetOf, cellCount) =>
    `Chaque lettre prend son rang dans l’alphabet (A = 1 … Z = 26). Le carré ${planetOf} compte ${String(cellCount)} cases : au-delà de ${String(cellCount)}, on repart de 1.`,
  ruleFormula: (cellCount) => `nombre = ((rang − 1) mod ${String(cellCount)}) + 1`,
  ruleExample: (letter, rank, cellCount, number) =>
    `Exemple : ${letter}, rang ${String(rank)} → ((${String(rank)} − 1) mod ${String(cellCount)}) + 1 = ${String(number)}`,
  ruleNoWrap: (cellCount) =>
    `Chaque lettre prend son rang dans l’alphabet (A = 1 … Z = 26). Le carré compte ${String(cellCount)} cases, plus que les 26 lettres : chaque lettre garde donc son rang.`,
  rulePythagorean: 'Sur le carré de Saturne, cette règle est la réduction pythagoricienne.',

  tableTitle: 'Lettre → nombre',
  tableHeadings: { letter: 'Lettre', rank: 'Rang', number: 'Case' },
  tableLabel: 'Table lettre, rang, case',
  tableEntry: (letter, rank, number) => `${letter} : rang ${String(rank)}, case ${String(number)}`,

  pathTitle: 'Chemin sur le carré',
  pathBody:
    'Le chemin relie les cases dans l’ordre des lettres : un cercle marque le départ, un trait perpendiculaire l’arrivée.',
  pathSequenceLabel: 'Cases :',
  loopCount: (count) =>
    count === 1
      ? 'Une boucle marque une case atteinte plusieurs fois de suite.'
      : `${String(count)} boucles marquent des cases atteintes plusieurs fois de suite.`,
  gridLabel: (planetOf, order, numbers) =>
    `Carré ${planetOf}, ${String(order)} × ${String(order)}, avec le chemin : ${numbers.join(', ')}`,
};

/** Texts of the explanation panel for a Spare sigil. */
const SPARE_EXPLANATION: SpareExplanationStrings = {
  reductionTitle: 'Lettres retirées',
  reductionBody: (keepVowels) =>
    keepVowels
      ? 'Accents et ponctuation ôtés, chaque lettre déjà écrite est retirée. Les voyelles sont gardées, comme demandé.'
      : 'Accents et ponctuation ôtés, chaque lettre déjà écrite est retirée, puis les voyelles A, E, I, O, U. Le Y reste : il sert souvent de consonne.',
  stripLabel: (count) => `Les ${counted(count, 'lettre', 'lettres')} de l’intention`,
  letterStatus: (reason) => {
    if (reason === 'duplicate') return ', retirée : doublon';
    if (reason === 'vowel') return ', retirée : voyelle';
    return ', gardée';
  },
  duplicatesLabel: 'Doublons',
  vowelsLabel: 'Voyelles',
  keptLabel: 'Retenues',
  noneRemoved: 'aucune',

  skeletonsTitle: 'Squelettes des lettres',
  skeletonsBody:
    'Chaque lettre retenue est réduite à un trait unique, puis retournée, tournée ou réduite avant d’être posée sur les autres.',
  skeletonsLabel: 'Lettres retenues et transformation de chacune',
  upright: 'droite',
  mirrored: 'miroir',
  turns: { 90: '¼ de tour', 180: 'demi-tour', 270: '¾ de tour' },
  scale: (percent) => `${String(percent)}${NBSP}%`,
  sharedStem: (letter) => `barre de ${letter}`,
  superimposedTitle: 'Superposées, avant fusion',
  superimposedLabel: (count) =>
    `Les ${counted(count, 'lettre', 'lettres')} superposées avant fusion`,

  choiceTitle: 'Composition retenue',
  choiceBody: (number, count) =>
    `Parmi ${String(count)} façons de poser ces lettres, toujours les mêmes pour cette intention et cette variante, la n°${NBSP}${String(number)} est la mieux composée : centrée, proche du carré, chaque lettre aussi fondue que possible dans les autres pour qu’aucune ne se lise seule.`,

  simplificationTitle: 'Simplification',
  simplificationBody: (before, after) => {
    const merged = 'Là où des traits se recouvrent, la partie commune n’est tracée qu’une fois';
    const recentred = 'Le sigil est enfin recentré sur son centre de gravité.';
    if (after < before) {
      return `${merged} : ${counted(before, 'segment', 'segments')} deviennent ${String(after)}. ${recentred}`;
    }
    if (after === before) {
      return `${merged} ; le sigil compte toujours ${counted(before, 'segment', 'segments')}. ${recentred}`;
    }
    return `${merged}. Un trait recouvert en partie est coupé autour de la partie commune : on passe de ${String(before)} à ${counted(after, 'segment', 'segments')}. ${recentred}`;
  },
};

/**
 * Writes a length in millimetres the French way, with one decimal.
 *
 * @param millimetres - Length.
 * @returns For instance `"0,6 mm"`, with a no-break space before the unit.
 */
function millimetresText(millimetres: number): string {
  return `${formatDecimal(millimetres, 'fr', 1)}${NBSP}mm`;
}

/**
 * Writes a length in centimetres the French way, decimals only when needed.
 *
 * @param centimetres - Length.
 * @returns For instance `"8 cm"` or `"6,5 cm"`, with a no-break space before the unit.
 */
function centimetresText(centimetres: number): string {
  const digits = Number.isInteger(centimetres) ? 0 : 1;
  return `${formatDecimal(centimetres, 'fr', digits)}${NBSP}cm`;
}

/**
 * How readable a kamea sigil stays, said in the export dialog and in the
 * privacy note. Here and in the privacy note, a no-break space keeps each
 * colon on the line of the word before it.
 */
const KAMEA_READABLE = `Un sigil kamea peut être relu par quelqu’un qui connaît la méthode${NBSP}: les lettres se retrouvent à partir des cases du carré. Un sigil de Spare est bien moins réversible.`;

/** Texts of the "Export" button and dialog. */
const EXPORT: ExportStrings = {
  open: 'Exporter',
  title: 'Exporter le sigil',
  formatLegend: 'Format',
  formats: { svg: 'SVG', png: 'PNG', pdf: 'PDF' },
  formatHelp: {
    svg: 'Dessin vectoriel, net à toute taille, pour un éditeur ou le web.',
    png: 'Image carrée, sur le fond du thème (blanc en mode pochoir).',
    pdf: 'Pochoir de tatouage sur une page A4 : noir pur sur blanc, à taille réelle, avec une règle de contrôle de 1 cm.',
  },
  resolutionLegend: 'Résolution',
  resolution: (pixels) => `${String(pixels)} px`,
  sizeLabel: 'Taille réelle (cm)',
  sizeHelp: 'Plus grande dimension du sigil imprimé, de 1 à 25 cm.',
  sizeError: (error) =>
    error === 'not-a-number'
      ? 'Écrivez une taille en centimètres, par exemple 8 ou 6,5.'
      : 'La taille doit être comprise entre 1 et 25 cm.',
  sizeTooLarge: (max) =>
    `Trop grand pour une page A4 : ce sigil tient au plus sur ${centimetresText(max)}.`,
  strokeLabel: 'Épaisseur du trait',
  strokeValue: millimetresText,
  strokeHelp: 'De 0,3 à 1,2 mm, respectée à l’impression ; 0,6 mm par défaut.',
  preview: (format) => `Aperçu du fichier ${format}`,
  cancel: 'Annuler',
  download: 'Télécharger',
  error: (format) =>
    `L’export ${format} a échoué. Réessayez ; si l’échec persiste, essayez un autre navigateur.`,
  kameaReadable: KAMEA_READABLE,
  pdf: (centimetres, millimetres) => ({
    ruler: '1 cm',
    instruction: 'Imprimer à 100 %, sans mise à l’échelle ni ajustement à la page.',
    details: `Sigil : ${centimetresText(centimetres)} dans sa plus grande dimension, trait de ${millimetresText(millimetres)}.`,
  }),
};

/**
 * Texts of the language selector. The language names are written in their own
 * language (the same in both dictionaries), as language pickers usually do.
 */
const LANGUAGE: LanguageToggleStrings = {
  legend: 'Langue de l’interface',
  codes: { fr: 'FR', en: 'EN' },
  names: { fr: 'Français', en: 'English' },
};

/** Texts of the theme selector. */
const THEME: ThemeToggleStrings = {
  legend: 'Thème',
  names: { system: 'Système', light: 'Encre sur papier', dark: 'Or sur noir' },
};

/** Texts of the privacy note opened from the footer. */
const PRIVACY: PrivacyNoteStrings = {
  open: 'Confidentialité',
  title: 'Confidentialité',
  nothingSent: `Tout se passe dans ce navigateur. L’intention n’est envoyée nulle part ni enregistrée${NBSP}: ni dans l’adresse de la page, ni sur l’appareil, ni dans le nom ou les métadonnées des fichiers exportés.`,
  preferences: `Seules deux préférences restent sur l’appareil, dans le stockage local du navigateur${NBSP}: la langue et le thème.`,
  hosting:
    'Le site est hébergé par GitHub Pages, qui journalise les adresses IP des visiteurs selon sa propre politique de confidentialité. Le site lui-même ne transmet rien et n’utilise ni cookie ni mesure d’audience.',
  kameaReadable: KAMEA_READABLE,
  close: 'Fermer',
};

/** All French texts of the interface. */
export const STRINGS_FR = {
  appTitle: 'Sigil',
  /** Meta description of the page, set by the app with the language (the page title is `appTitle`). */
  pageDescription:
    'Générateur de sigils déterministe : carrés magiques (kamea) et méthode de Spare, tracés en SVG dans votre navigateur.',
  language: LANGUAGE,
  theme: THEME,
  privacy: PRIVACY,

  controls: {
    heading: 'Tracer un sigil',
  },

  intention: {
    label: 'Intention',
    help: 'Une phrase courte, au présent. Elle reste dans ce navigateur : rien n’est envoyé ni enregistré.',
    letterCount: (count: number): string =>
      count === 0
        ? 'Aucune lettre à tracer pour l’instant'
        : `${counted(count, 'lettre', 'lettres')} à tracer`,
  },

  method: {
    legend: 'Méthode',
    kamea: 'Kamea',
    spare: 'Spare',
  },

  spare: {
    keepVowels: 'Garder les voyelles',
    keepVowelsHelp: 'Par défaut, Spare retire les voyelles A, E, I, O, U.',
    on: 'oui',
    off: 'non',
    keepVowelsAndTrace: 'Garder les voyelles et tracer',
  },

  planet: {
    legend: 'Carré planétaire',
    names: PLANET_NAMES,
    size: (order: number): string => `${String(order)}×${String(order)}`,
  },

  trace: 'Tracer',
  replay: 'Rejouer',
  otherVariant: 'Autre variante',
  export: EXPORT,
  replayStepwiseHint:
    'Mouvement réduit : chaque clic sur « Rejouer » trace une étape de plus, sans animation.',
  replayStep: (step: number, count: number): string =>
    step >= count
      ? `Pas à pas : étape ${String(step)} sur ${String(count)}, sigil complet.`
      : `Pas à pas : étape ${String(step)} sur ${String(count)}.`,

  style: {
    title: 'Style',
    strokeWidth: 'Épaisseur',
    strokeWidthValue: (width: number, level: StrokeWidthLevel): string =>
      `${STROKE_WIDTH_LEVELS[level]} · ${strokeWidthNumber(width)}`,
    strokeWidthSpoken: (width: number, level: StrokeWidthLevel): string =>
      `${strokeWidthNumber(width)}, ${STROKE_WIDTH_LEVELS[level]}`,
    strokeWidthHelp: 'De 0,4 à 2,4 sur un cadre de 100 ; 1,2 par défaut.',
    stencil: 'Pochoir tatouage',
    stencilHelp: (printSizeCm: number): string =>
      `Noir pur sur blanc, trait unique, sans cercle d’encadrement. L’épaisseur est en millimètres pour une impression de ${centimetresText(printSizeCm)} (taille réglable dans «${NBSP}Exporter${NBSP}»).`,
    strokeMmValue: millimetresText,
    strokeMmHelp: 'De 0,3 à 1,2 mm sur le papier ; 0,6 mm par défaut.',
    roundEnds: 'Extrémités arrondies',
    frameCircle: 'Cercle d’encadrement',
    on: 'oui',
    off: 'non',
  },

  stage: {
    heading: 'Sigil',
    empty: 'Écrivez une intention, choisissez un carré, puis tracez.',
    emptySpare: 'Écrivez une intention, puis tracez.',
    error: 'Rien à tracer : corrigez l’intention d’après le message sous le champ.',
    label: (planet: Planet): string => `Sigil kamea ${PLANET_OF[planet]}`,
    traced: (letterCount: number, planet: Planet): string =>
      `Sigil tracé : ${counted(letterCount, 'lettre', 'lettres')} sur le carré ${PLANET_OF[planet]}.`,
    spareLabel: (variant: number): string => `Sigil de Spare, variante ${String(variant)}`,
    spareTraced: (keptCount: number, variant: number): string =>
      `Sigil de Spare tracé : ${counted(keptCount, 'lettre retenue', 'lettres retenues')}, variante ${String(variant)}.`,
    variant: (variant: number): string => `Variante ${String(variant)}`,
  },

  errors: {
    empty: 'Écrivez une intention avant de tracer, par exemple « Je suis calme ».',
    noLatinLetter: (ignored: readonly string[]): string =>
      ignored.length === 0
        ? 'Aucune lettre latine à tracer. Écrivez l’intention avec les lettres A à Z (les accents sont acceptés).'
        : `Aucune lettre latine à tracer : ${quoted(ignored)} ne se ${ignored.length > 1 ? 'tracent' : 'trace'} pas. Écrivez l’intention avec les lettres A à Z (les accents sont acceptés).`,
    tooFewLetters: 'Une seule lettre ne trace aucun chemin. Écrivez au moins deux lettres.',
    singleCell: (number: number, planet: Planet): string =>
      `Toutes les lettres tombent sur la case ${String(number)} du carré ${PLANET_OF[planet]} : le tracé serait un simple point. Choisissez un autre carré ou ajoutez des lettres.`,
    onlyVowels:
      'Sans ses voyelles, cette intention ne laisse aucune lettre : Spare retire les doublons et les voyelles. Gardez les voyelles pour la tracer.',
    noLetterLeft:
      'Aucune lettre ne reste une fois les doublons retirés. Modifiez l’intention puis tracez à nouveau.',
    invalidLetter:
      'Un caractère n’a pas pu être converti en nombre. Modifiez l’intention puis tracez à nouveau.',
  },

  ignoredWarning: (ignored: readonly string[]): string =>
    `Caractères ignorés : ${quoted(ignored)}. Seules les lettres A à Z sont tracées.`,

  explain: {
    title: 'Comment c’est fait',
    empty: 'Chaque étape du calcul s’affichera ici une fois le sigil tracé.',
    kamea: KAMEA_EXPLANATION,
    spare: SPARE_EXPLANATION,
  },
};

/** Shape every interface dictionary must have. */
export type AppStrings = typeof STRINGS_FR;
