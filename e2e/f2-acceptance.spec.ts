/**
 * Acceptance scenarios of feature F2 (Spare sigil), played on the production
 * build: reduction shown in the panel, determinism across reloads, variants,
 * the bind-rune structure (D19, D20) measured on the rendered path data, the
 * "only vowels" message, the vowels option resetting the variant, the
 * single-word rule (D18), privacy of the intention, CSP, 375 px layout and
 * keyboard use.
 *
 * How close the runes are to the board approved by the owner is a visual
 * judgement and is not asserted here: it is recorded in the tester report.
 */
import { expect, test, type Page } from '@playwright/test';

/**
 * Intention of the reference scenario: one word (D18) whose reduction removes
 * duplicates (L I T) and vowels (A U I E) and keeps five letters, T R N Q L.
 */
const CALM = 'Tranquillité';

/** Abscissa of the central shaft of a bind rune, in frame units (D19). */
const SHAFT_X = 50;

/** How far from `SHAFT_X` a vertical segment may sit and still belong to the shaft. */
const SHAFT_X_TOLERANCE = 0.6;

/** Share of the drawing height the continuous shaft must span ("the greater part of the height"). */
const MIN_SHAFT_SHARE = 0.7;

/**
 * Largest gap between two strokes still counted as touching, in frame units:
 * half the default stroke width (1.2), so the strokes visibly meet on screen.
 */
const CONTACT_DISTANCE = 0.6;

/** Two segments closer than this angle, in degrees, are parallel (hatching, D21). */
const PARALLEL_ANGLE_DEGREES = 6;

/** Gap range, in frame units, between two parallel segments that reads as hatching. */
const HATCH_GAP_MIN = 0.5;
const HATCH_GAP_MAX = 5;

/** Overlap, in frame units, from which two close parallel segments count as hatching. */
const HATCH_MIN_OVERLAP = 3;

/** Drawing area of the frame: 10 units of margin on each side (`frame.ts`). */
const DRAWING_MIN = 10;
const DRAWING_MAX = 90;

/** Rounding tolerance when comparing coordinates printed with three decimals. */
const EPSILON = 0.01;

/**
 * Words played by the bind-rune scenario, French and English, short and long,
 * with accents. At least 30 are required (scenario 4).
 */
const RUNE_WORDS: readonly string[] = [
  'Tranquillité',
  'Calme',
  'Amour',
  'Force',
  'Chance',
  'Courage',
  'Protection',
  'Sérénité',
  'Liberté',
  'Strength',
  'Luck',
  'Home',
  'Grace',
  'Energy',
  'Patience',
  'Lumière',
  'Voyage',
  'Paix',
  'Joie',
  'Espoir',
  'Sagesse',
  'Harmonie',
  'Équilibre',
  'Confiance',
  'Gratitude',
  'Résilience',
  'Peace',
  'Love',
  'Wisdom',
  'Focus',
  'Balance',
  'Healing',
  'Victory',
  'Détermination',
  'Clarity',
  'Désinstitutionnalisation',
];

/** Number of variants measured for each word of `RUNE_WORDS`. */
const RUNE_VARIANTS = 3;

test.use({ reducedMotion: 'reduce' });

/**
 * Selects Spare, sets the vowels option, types the intention and presses "Tracer".
 *
 * @param page - Page on the app.
 * @param intention - Text to type.
 * @param keepVowels - Wanted state of the "Garder les voyelles" option.
 */
async function traceSpare(page: Page, intention: string, keepVowels = false): Promise<void> {
  await page.getByText('Spare', { exact: true }).click();
  const option = page.getByRole('switch', { name: 'Garder les voyelles' });
  if ((await option.isChecked()) !== keepVowels) {
    // The switch input is visually hidden: click its visible label.
    await page.getByText('Garder les voyelles', { exact: true }).click();
  }
  await page.getByRole('textbox', { name: 'Intention' }).fill(intention);
  await page.getByRole('button', { name: 'Tracer' }).click();
}

/**
 * Shows variant `variant` of an intention by clicking "Autre variante".
 *
 * @param page - Page showing variant 1 of a Spare sigil.
 * @param variant - Displayed variant number, from 1.
 */
async function goToVariant(page: Page, variant: number): Promise<void> {
  for (let current = 1; current < variant; current += 1) {
    await page.getByRole('button', { name: 'Autre variante' }).click();
  }
  await expect(
    page.getByRole('img', { name: `Sigil de Spare, variante ${String(variant)}` }),
  ).toBeVisible();
}

/**
 * Clicks "Autre variante" once and waits for the expected variant number.
 *
 * @param page - Page showing the previous variant.
 * @param variant - Variant number expected after the click.
 */
async function nextVariant(page: Page, variant: number): Promise<void> {
  await page.getByRole('button', { name: 'Autre variante' }).click();
  await expect(
    page.getByRole('img', { name: `Sigil de Spare, variante ${String(variant)}` }),
  ).toBeVisible();
}

/**
 * Path data of the Spare sigil shown, one entry per stroke.
 *
 * @param page - Page showing a Spare sigil.
 * @returns The `d` attributes in tracing order.
 */
async function strokePaths(page: Page): Promise<string[]> {
  return page
    .getByRole('img', { name: /^Sigil de Spare/ })
    .locator('path')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d') ?? ''));
}

/** A point of the frame. */
type Point = readonly [number, number];

/** A straight stroke between two points. */
interface Segment {
  readonly from: Point;
  readonly to: Point;
}

/**
 * Splits the `d` attributes of a rendered sigil into straight segments.
 *
 * @param paths - `d` attributes, absolute `M`/`L` polylines only.
 * @returns Every segment, plus the commands that are neither `M` nor `L`.
 */
function toSegments(paths: readonly string[]): { segments: Segment[]; foreign: string[] } {
  const segments: Segment[] = [];
  const foreign: string[] = [];
  for (const d of paths) {
    foreign.push(...(d.match(/[A-Za-z]/g) ?? []).filter((command) => !'ML'.includes(command)));
    const points = [...d.matchAll(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g)].map(
      (match) => [Number(match[1]), Number(match[2])] as const,
    );
    points.forEach((to, index) => {
      const from = points[index - 1];
      if (from !== undefined) segments.push({ from, to });
    });
  }
  return { segments, foreign };
}

/**
 * Distance from a point to a segment.
 *
 * @param point - The point.
 * @param segment - The segment.
 * @returns The shortest distance, in frame units.
 */
function distanceToSegment(point: Point, segment: Segment): number {
  const { from, to } = segment;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const squared = dx * dx + dy * dy;
  const t =
    squared === 0
      ? 0
      : Math.max(0, Math.min(1, ((point[0] - from[0]) * dx + (point[1] - from[1]) * dy) / squared));
  return Math.hypot(point[0] - (from[0] + t * dx), point[1] - (from[1] + t * dy));
}

/**
 * Whether two segments cross each other.
 *
 * @param a - First segment.
 * @param b - Second segment.
 * @returns `true` when they share an interior point.
 */
function cross(a: Segment, b: Segment): boolean {
  const side = (p: Point, q: Point, r: Point): number =>
    Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return (
    side(a.from, a.to, b.from) * side(a.from, a.to, b.to) < 0 &&
    side(b.from, b.to, a.from) * side(b.from, b.to, a.to) < 0
  );
}

/**
 * Shortest distance between two segments.
 *
 * @param a - First segment.
 * @param b - Second segment.
 * @returns 0 when they cross, otherwise the smallest endpoint-to-segment distance.
 */
function segmentDistance(a: Segment, b: Segment): number {
  if (cross(a, b)) return 0;
  return Math.min(
    distanceToSegment(a.from, b),
    distanceToSegment(a.to, b),
    distanceToSegment(b.from, a),
    distanceToSegment(b.to, a),
  );
}

/**
 * Whether two segments form a hatching: nearly parallel, a little apart and
 * overlapping along their length.
 *
 * @param a - First segment.
 * @param b - Second segment.
 * @returns `true` for a pair that reads as parallel hatch strokes.
 */
function isHatching(a: Segment, b: Segment): boolean {
  const ax = a.to[0] - a.from[0];
  const ay = a.to[1] - a.from[1];
  const bx = b.to[0] - b.from[0];
  const by = b.to[1] - b.from[1];
  const lengthA = Math.hypot(ax, ay);
  const lengthB = Math.hypot(bx, by);
  if (lengthA === 0 || lengthB === 0) return false;
  const sine = Math.abs(ax * by - ay * bx) / (lengthA * lengthB);
  const cosine = Math.abs(ax * bx + ay * by) / (lengthA * lengthB);
  if (Math.atan2(sine, cosine) > (PARALLEL_ANGLE_DEGREES * Math.PI) / 180) return false;
  // Overlap along the direction of `a`, gap measured at the middle of the overlap.
  const ux = ax / lengthA;
  const uy = ay / lengthA;
  const along = (p: Point): number => (p[0] - a.from[0]) * ux + (p[1] - a.from[1]) * uy;
  const start = Math.max(0, Math.min(along(b.from), along(b.to)));
  const end = Math.min(lengthA, Math.max(along(b.from), along(b.to)));
  if (end - start < HATCH_MIN_OVERLAP) return false;
  const middle = (start + end) / 2;
  const onA: Point = [a.from[0] + ux * middle, a.from[1] + uy * middle];
  const gap = Math.abs((onA[0] - b.from[0]) * -uy + (onA[1] - b.from[1]) * ux);
  return gap >= HATCH_GAP_MIN && gap <= HATCH_GAP_MAX;
}

/**
 * Checks the rendered path data of one sigil against the bind-rune criteria
 * of scenario 4 (D19, D20, D21).
 *
 * @param paths - `d` attributes of the sigil, in tracing order.
 * @returns One message per broken criterion; empty when the sigil is a bind rune.
 */
function runeViolations(paths: readonly string[]): string[] {
  const { segments, foreign } = toSegments(paths);
  if (foreign.length > 0) return [`curved or relative commands: ${foreign.join('')}`];
  if (segments.length === 0) return ['no stroke'];
  const violations: string[] = [];
  const xs = segments.flatMap(({ from, to }) => [from[0], to[0]]);
  const ys = segments.flatMap(({ from, to }) => [from[1], to[1]]);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  const height = maxY - minY;

  if (!(height > maxX - minX)) {
    violations.push(`not taller than wide: ${(maxX - minX).toFixed(1)} x ${height.toFixed(1)}`);
  }
  if (minX < DRAWING_MIN - EPSILON || minY < DRAWING_MIN - EPSILON) {
    violations.push('outside the drawing area (low side)');
  }
  if (maxX > DRAWING_MAX + EPSILON || maxY > DRAWING_MAX + EPSILON) {
    violations.push('outside the drawing area (high side)');
  }

  // Continuous vertical shaft: merge the vertical segments lying on x = SHAFT_X.
  const spans = segments
    .filter(
      ({ from, to }) =>
        Math.abs(from[0] - to[0]) < EPSILON && Math.abs(from[0] - SHAFT_X) <= SHAFT_X_TOLERANCE,
    )
    .map(({ from, to }) => [Math.min(from[1], to[1]), Math.max(from[1], to[1])] as const)
    .sort((a, b) => a[0] - b[0]);
  let longest = 0;
  let runStart = 0;
  let runEnd = -Infinity;
  for (const [start, end] of spans) {
    if (start > runEnd + CONTACT_DISTANCE) runStart = start;
    runEnd = Math.max(runEnd, end);
    longest = Math.max(longest, runEnd - runStart);
  }
  if (longest < MIN_SHAFT_SHARE * height) {
    violations.push(`no continuous shaft: ${longest.toFixed(1)} of ${height.toFixed(1)}`);
  }

  // Every stroke is joined to the others through contacts, the shaft included.
  const parent = segments.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root] ?? root;
    return root;
  };
  segments.forEach((a, i) => {
    segments.slice(i + 1).forEach((b, offset) => {
      if (segmentDistance(a, b) <= CONTACT_DISTANCE) parent[find(i)] = find(i + 1 + offset);
    });
  });
  const groups = new Set(segments.map((_, index) => find(index))).size;
  if (groups > 1) violations.push(`${String(groups)} groups of strokes not joined together`);

  // No hatching.
  let hatches = 0;
  segments.forEach((a, i) => {
    segments.slice(i + 1).forEach((b) => {
      if (isHatching(a, b)) hatches += 1;
    });
  });
  if (hatches > 0) violations.push(`${String(hatches)} pairs of parallel strokes forming a hatch`);
  return violations;
}

test('scenario 1: shows the removed letters and the kept letters T R N Q L', async ({ page }) => {
  await page.goto('./');
  await traceSpare(page, CALM);

  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 1' })).toBeVisible();
  await expect(page.getByText('L I T', { exact: true })).toBeVisible(); // duplicates
  await expect(page.getByText('A U I E', { exact: true })).toBeVisible(); // vowels
  await expect(page.getByText('T R N Q L', { exact: true })).toBeVisible(); // kept
});

test('scenario 2: same intention and settings give the same sigil after a reload, with or without punctuation', async ({
  page,
}) => {
  await page.goto('./');
  await traceSpare(page, CALM);
  const first = (await strokePaths(page)).join('|');
  expect(first.length).toBeGreaterThan(0);

  await page.reload();
  await traceSpare(page, CALM);
  expect((await strokePaths(page)).join('|')).toBe(first);

  // The seed comes from the kept letters, not from the raw text.
  await traceSpare(page, 'tranquillite!');
  expect((await strokePaths(page)).join('|')).toBe(first);
});

test('scenario 3: "Autre variante" gives a different sigil each time, and variant n is always the same', async ({
  page,
}) => {
  const variantCount = 5;

  /**
   * Plays variants 1 to `variantCount`.
   *
   * @returns Path data of each variant, in order.
   */
  async function playVariants(): Promise<string[]> {
    await traceSpare(page, CALM);
    const run = [(await strokePaths(page)).join('|')];
    for (let variant = 2; variant <= variantCount; variant += 1) {
      await nextVariant(page, variant);
      run.push((await strokePaths(page)).join('|'));
    }
    return run;
  }

  await page.goto('./');
  const firstRun = await playVariants();
  expect(new Set(firstRun).size).toBe(variantCount);

  await page.reload();
  expect(await playVariants()).toEqual(firstRun);
});

test('scenario 4: every sigil is a bind rune: continuous shaft, joined straight strokes, taller than wide, no hatching', async ({
  page,
}) => {
  test.setTimeout(180_000);
  expect(RUNE_WORDS.length).toBeGreaterThanOrEqual(30);
  const broken: string[] = [];
  let measured = 0;
  await page.goto('./');
  for (const word of RUNE_WORDS) {
    await traceSpare(page, word);
    for (let variant = 1; variant <= RUNE_VARIANTS; variant += 1) {
      if (variant > 1) await nextVariant(page, variant);
      await expect(
        page.getByRole('img', { name: `Sigil de Spare, variante ${String(variant)}` }),
      ).toBeVisible();
      const violations = runeViolations(await strokePaths(page));
      if (violations.length > 0) {
        broken.push(`${word} v${String(variant)}: ${violations.join('; ')}`);
      }
      measured += 1;
    }
  }
  expect(measured).toBeGreaterThanOrEqual(90);
  expect(broken).toEqual([]);
});

test('scenario 5: an intention with no consonant left proposes to keep the vowels', async ({
  page,
}) => {
  await page.goto('./');
  await traceSpare(page, 'oui');

  await expect(page.getByText(/Gardez les voyelles pour la tracer/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Intention' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByRole('img', { name: /^Sigil de Spare/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Garder les voyelles et tracer' }).click();
  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 1' })).toBeVisible();
});

test('keeps Y as a consonant: "Yeux" retains Y and X', async ({ page }) => {
  await page.goto('./');
  await traceSpare(page, 'Yeux');
  await expect(page.getByText('Y X', { exact: true })).toBeVisible();
});

test('tracing again after changing the vowels option restarts at variant 1', async ({ page }) => {
  await page.goto('./');
  await traceSpare(page, CALM);
  await goToVariant(page, 3);

  await traceSpare(page, CALM, true);
  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 1' })).toBeVisible();
  await expect(page.getByText('T R A N Q U I L E', { exact: true })).toBeVisible();
});

test('scenario 6: a sentence of several words asks for a single word, for Spare and kamea (D18)', async ({
  page,
}) => {
  await page.goto('./');
  await traceSpare(page, 'je suis calme');

  const field = page.getByRole('textbox', { name: 'Intention' });
  const message = /Un seul mot, sans espace : au-delà d’un mot, le sigil devient illisible\./;
  await expect(page.getByText(message)).toBeVisible();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(field).toBeFocused();
  await expect(field).toHaveAccessibleDescription(message);
  await expect(page.getByRole('img', { name: /^Sigil de Spare/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Autre variante' })).toBeDisabled();

  await page.getByText('Kamea', { exact: true }).click();
  await page.getByRole('button', { name: 'Tracer' }).click();
  await expect(page.getByText(message)).toBeVisible();
  await expect(page.getByRole('img', { name: /^Sigil kamea/ })).toHaveCount(0);

  // One word traces again, and the error goes away.
  await page.getByText('Spare', { exact: true }).click();
  await field.fill('Calme');
  await page.getByRole('button', { name: 'Tracer' }).click();
  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 1' })).toBeVisible();
  await expect(field).toHaveAttribute('aria-invalid', 'false');
});

test('scenario 6: a word of more than 24 letters is refused with its count (D18)', async ({
  page,
}) => {
  await page.goto('./');
  await traceSpare(page, 'Anticonstitutionnellement');

  await expect(page.getByText('25 lettres : 1 de trop, 24 au plus')).toBeVisible();
  await expect(page.getByText(/Ce mot donne 25 lettres, 24 au plus/)).toBeVisible();
  await expect(page.getByRole('img', { name: /^Sigil de Spare/ })).toHaveCount(0);
});

test('keeps the intention out of the URL, storage, caches and sigil, and breaks no CSP rule', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { cspViolations: violations });
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(event.effectiveDirective);
    });
  });
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto('./');
  const before = page.url();

  await traceSpare(page, 'Trouvaille');
  await goToVariant(page, 2);

  expect(page.url()).toBe(before);
  const leaks = await page.evaluate(async () => {
    const words = ['trouvaille', 'trouv'];
    const holders = [
      JSON.stringify(Object.entries(localStorage)),
      JSON.stringify(Object.entries(sessionStorage)),
      document.cookie,
      (await caches.keys()).join(';'),
      (await indexedDB.databases()).map((database) => database.name).join(';'),
      document.title,
      document.querySelector('svg[role="img"]')?.outerHTML ?? '',
    ].map((text) => text.toLowerCase());
    return words.filter((word) => holders.some((text) => text.includes(word)));
  });
  expect(leaks).toEqual([]);
  expect(
    await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
  ).toEqual([]);
  expect(problems).toEqual([]);
});

test('is usable at 375 px: no horizontal scroll, touch-sized controls, sigil inside the screen', async ({
  page,
}) => {
  const minTouchSide = 44;
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('./');
  await traceSpare(page, CALM);
  const sigil = page.getByRole('img', { name: 'Sigil de Spare, variante 1' });
  await expect(sigil).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
  const box = await sigil.boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
  for (const name of ['Tracer', 'Autre variante', 'Rejouer']) {
    const button = await page.getByRole('button', { name }).boundingBox();
    expect(button?.height).toBeGreaterThanOrEqual(minTouchSide);
  }
  await goToVariant(page, 2);
});

test('can be driven entirely with the keyboard', async ({ page }) => {
  await page.goto('./');
  // First stops: the language then the theme selector of the header, on their checked radios.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Français' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('radio', { name: 'Système' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Intention' })).toBeFocused();
  await page.keyboard.type(CALM);

  // Method radio group: the checked radio holds the tab stop; arrows change it.
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('radio', { name: 'Spare' })).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('switch', { name: 'Garder les voyelles' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Tracer' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 1' })).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Autre variante' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('img', { name: 'Sigil de Spare, variante 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Autre variante' })).toBeFocused();
});
