/**
 * Every text shown by the interface, in French: labels, help, error and
 * status messages, the accessible names, and the explanation panel.
 *
 * Exposes `STRINGS_FR` and its type `AppStrings`. The English dictionary of
 * the i18n task copies this module and satisfies the same type. Texts that
 * depend on a value are functions of that value. Contains no logic beyond
 * French grammar (plurals, elision).
 */
import type {
  KameaExplanationStrings,
  SpareExplanationStrings,
} from '../features/explain/index.ts';
import type { Planet } from '../features/sigil/types.ts';

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
  return `${String(count)} ${count > 1 ? plural : singular}`;
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
    `Parmi ${String(count)} façons de poser ces lettres, toujours les mêmes pour cette intention et cette variante, la n°${NBSP}${String(number)} est la plus équilibrée : centrée, compacte, sans lettre isolée.`,

  simplificationTitle: 'Simplification',
  simplificationBody: (before, after) =>
    before === after
      ? `Aucun trait ne se recouvre : les ${counted(before, 'segment', 'segments')} restent tels quels. Le sigil est enfin recentré sur son centre de gravité.`
      : `Les traits qui se recouvrent sont fusionnés et tracés une seule fois : ${counted(before, 'segment', 'segments')} deviennent ${String(after)}. Le sigil est enfin recentré sur son centre de gravité.`,
};

/** All French texts of the interface. */
export const STRINGS_FR = {
  appTitle: 'Sigil',

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
        : `Aucune lettre latine à tracer : ${quoted(ignored)} ne se tracent pas. Écrivez l’intention avec les lettres A à Z (les accents sont acceptés).`,
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
