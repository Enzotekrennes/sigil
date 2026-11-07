/**
 * Acceptance journey of feature F3 (animated tracing and style settings) on
 * the production build: the four plan scenarios, then the checks of the
 * build additions (D15, T17, T19): total tracing time, stroke width range,
 * the drawing inside the framing circle with a visible gap, the final kamea
 * loop kept clear of the end bar, the step-by-step replay under reduced
 * motion, style changes that never replay the tracing, the strict CSP (D12),
 * the 375 px layout and keyboard use of the Style panel.
 *
 * Set `F3_EVIDENCE_DIR` to also save screenshots there; nothing is written
 * otherwise. The app is reached through the Playwright `baseURL`.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

/** Intention of the F1 scenario, traced on Saturn by default. */
const CALM = 'Je suis calme';

/** Intention with a doubled letter, so the kamea ends with a loop. */
const BELLE_ALLEE = 'Belle allée';

/** Intention of more than 120 letters, to stress the cap on the Spare tracing time. */
const LONG_INTENTION =
  'Je trouve chaque jour la force de continuer mes projets avec patience courage et confiance ' +
  'tout en gardant le calme necessaire pour apprendre de mes erreurs et avancer sereinement';

/** Kamea planets, as labelled in the planet picker. */
const PLANETS = [
  'Saturne 3×3',
  'Jupiter 4×4',
  'Mars 5×5',
  'Soleil 6×6',
  'Vénus 7×7',
  'Mercure 8×8',
  'Lune 9×9',
] as const;

/** Total time the tracing may take, in ms, without the framing circle (design: ≤ ~3 s). */
const TRACE_BUDGET_MS = 3000;

/** Margin allowed on a wall-clock measure, which includes input and scheduling latency. */
const WALL_CLOCK_MARGIN_MS = 400;

/** Smallest clear gap, in frame units, between the ink and the framing circle to count as visible. */
const MIN_FRAME_GAP = 1;

/** Stroke widths exercised: the slider's two ends and its default. */
const STROKE_WIDTHS = [0.4, 1.2, 2.4] as const;

/**
 * Saves a screenshot when `F3_EVIDENCE_DIR` is set: the sigil alone when one is shown,
 * the whole page when `name` starts with `page-` or `mobile-`.
 *
 * @param page - Page to capture.
 * @param name - File name without extension.
 */
async function shot(page: Page, name: string): Promise<void> {
  const directory = process.env.F3_EVIDENCE_DIR;
  if (directory === undefined) return;
  // Timeline captures are taken mid-tracing on purpose; every other one shows the finished sigil.
  if (!/^(s1-|s3-start|s4-replaying)/.test(name)) {
    await page.waitForFunction(() =>
      document.getAnimations().every((animation) => animation.playState !== 'running'),
    );
  }
  const wholePage = name.startsWith('page-') || name.startsWith('mobile-');
  const target = sigil(page);
  if (wholePage || (await target.count()) === 0) {
    await page.screenshot({ path: `${directory}/${name}.png`, fullPage: wholePage });
    return;
  }
  await target.screenshot({ path: `${directory}/${name}.png` });
}

/**
 * Registers a collector of Content Security Policy violations on every page load.
 *
 * @param page - Page to listen on.
 */
async function collectCspViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { cspViolations: violations });
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
}

/**
 * Reads the violations gathered by `collectCspViolations`.
 *
 * @param page - Page that registered the collector.
 * @returns Directive and blocked resource of each violation.
 */
async function cspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
}

/**
 * Types the intention and presses "Tracer", on the method already selected.
 *
 * @param page - Page on the app.
 * @param intention - Text to type.
 */
async function trace(page: Page, intention = CALM): Promise<void> {
  await page.getByLabel('Intention').fill(intention);
  await page.getByRole('button', { name: 'Tracer' }).click();
}

/**
 * Picks a kamea planet, then traces.
 *
 * @param page - Page on the app.
 * @param planet - Label of the planet radio.
 * @param intention - Text to type.
 */
async function traceKamea(page: Page, planet: string, intention: string): Promise<void> {
  await page.getByRole('radio', { name: planet }).check({ force: true });
  await trace(page, intention);
}

/**
 * Selects Spare, then traces.
 *
 * @param page - Page on the app.
 * @param intention - Text to type.
 */
async function traceSpare(page: Page, intention: string): Promise<void> {
  // The radio itself is visually hidden: click its visible segment, as a user does.
  await page.getByText('Spare', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Spare' })).toBeChecked();
  await trace(page, intention);
}

/**
 * The sigil shown, kamea or Spare.
 *
 * @param page - Page showing a sigil.
 * @returns Its locator.
 */
function sigil(page: Page): Locator {
  return page.getByRole('img', { name: /^Sigil (kamea|de Spare)/ });
}

/**
 * Run key of the tracing shown: it changes only when the tracing restarts.
 *
 * @param page - Page showing a sigil.
 * @returns The `data-run` attribute of the sigil's ink group.
 */
async function runKey(page: Page): Promise<string | null> {
  return sigil(page).locator('[data-run]').getAttribute('data-run');
}

/**
 * Moves the stroke width slider to a value.
 *
 * @param page - Page with the Style section open.
 * @param value - Width in frame units.
 */
async function setStrokeWidth(page: Page, value: number): Promise<void> {
  await page.getByRole('slider', { name: 'Épaisseur' }).fill(String(value));
}

/**
 * Turns the framing circle on or off through its switch.
 *
 * @param page - Page with the Style section open.
 * @param on - Wanted state.
 */
async function setFrame(page: Page, on: boolean): Promise<void> {
  const toggle = page.getByRole('switch', { name: 'Cercle d’encadrement' });
  if ((await toggle.isChecked()) !== on) await toggle.click({ force: true });
  if (on) await expect(toggle).toBeChecked();
  else await expect(toggle).not.toBeChecked();
}

/** A CSS animation running inside the sigil, as the browser reports it. */
interface SigilAnimation {
  /** Keyframes name, e.g. `sigil-renderer-draw`. */
  readonly name: string;
  /** CSS class of the animated element. */
  readonly target: string;
  /** Delay before it starts, in ms. */
  readonly delay: number;
  /** Duration of one iteration, in ms. */
  readonly duration: number;
  /** Delay plus duration, in ms: when it ends, counted from the run start. */
  readonly endTime: number;
  /** Current time, in ms. */
  readonly currentTime: number;
  /** Geometric length of the animated element, 0 for a mark. */
  readonly length: number;
}

/**
 * Lists the CSS animations running on the sigil.
 *
 * @param page - Page showing a sigil.
 * @returns One entry per animation, in document order.
 */
async function sigilAnimations(page: Page): Promise<SigilAnimation[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => {
        const effect = animation.effect;
        return (
          effect instanceof KeyframeEffect &&
          effect.target instanceof Element &&
          effect.target.closest('svg[role="img"]') !== null
        );
      })
      .map((animation) => {
        const effect = animation.effect as KeyframeEffect;
        const element = effect.target;
        if (!(element instanceof Element)) throw new Error('Animation without a target.');
        const timing = effect.getComputedTiming();
        return {
          name: (animation as CSSAnimation).animationName,
          target: element.getAttribute('class') ?? element.tagName,
          delay: Number(timing.delay),
          duration: Number(timing.duration),
          endTime: Number(timing.endTime),
          currentTime: Number(animation.currentTime ?? 0),
          length: element instanceof SVGGeometryElement ? element.getTotalLength() : 0,
        };
      }),
  );
}

/**
 * Time the tracing takes without the framing circle: the latest end among the animations.
 *
 * @param animations - Animations of the sigil.
 * @returns Duration in ms.
 */
function tracingEnd(animations: readonly SigilAnimation[]): number {
  const ends = animations.filter((a) => !a.target.includes('frame')).map((a) => a.endTime);
  return Math.max(0, ...ends);
}

/**
 * Presses "Tracer" and waits for the tracing, framing circle apart, to finish.
 *
 * @param page - Page with an intention already typed.
 * @returns Wall-clock time from the click to the last animation's end, in ms.
 */
async function timeTracing(page: Page): Promise<number> {
  await page.evaluate(() => {
    const state = { start: 0, end: 0 };
    Object.assign(window, { traceClock: state });
    const settle = (): void => {
      const running = document.getAnimations().filter((animation) => {
        const effect = animation.effect;
        return (
          effect instanceof KeyframeEffect &&
          effect.target instanceof Element &&
          effect.target.closest('svg[role="img"]') !== null &&
          !(effect.target.getAttribute('class') ?? '').includes('frame')
        );
      });
      if (running.length > 0 && running.every((animation) => animation.playState === 'finished')) {
        state.end = performance.now();
        return;
      }
      requestAnimationFrame(settle);
    };
    document.addEventListener(
      'click',
      () => {
        state.start = performance.now();
        requestAnimationFrame(settle);
      },
      { once: true, capture: true },
    );
  });
  await page.getByRole('button', { name: 'Tracer' }).click();
  await page.waitForFunction(
    () => (window as unknown as { traceClock: { end: number } }).traceClock.end > 0,
    undefined,
    { timeout: 8000 },
  );
  return page.evaluate(() => {
    const clock = (window as unknown as { traceClock: { start: number; end: number } }).traceClock;
    return clock.end - clock.start;
  });
}

/** A point of the frame. */
type Point = readonly [number, number];

/** Everything needed to measure how far the ink reaches from the framing circle's centre. */
interface InkGeometry {
  /** Centre of the framing circle. */
  readonly center: Point;
  /** Radius of the framing circle's centreline. */
  readonly frameRadius: number;
  /** Stroke width of the framing circle. */
  readonly frameStroke: number;
  /** Stroke width of the ink. */
  readonly strokeWidth: number;
  /** Whether the line ends are round (else butt caps and mitred joins). */
  readonly round: boolean;
  /** Miter limit of the ink's joins. */
  readonly miterLimit: number;
  /** Polylines of the drawing. */
  readonly strokes: readonly (readonly Point[])[];
  /** Circle marks (start circle, loops), in document order. */
  readonly circles: readonly { readonly center: Point; readonly radius: number }[];
  /** Straight marks (end bar). */
  readonly bars: readonly (readonly [Point, Point])[];
}

/**
 * Reads the geometry of the sigil shown, which must have its framing circle on.
 *
 * @param page - Page showing a sigil with the framing circle.
 * @returns The ink and the circle, in frame units.
 */
async function inkGeometry(page: Page): Promise<InkGeometry> {
  return sigil(page).evaluate((svg) => {
    const number = (element: Element, name: string): number => Number(element.getAttribute(name));
    const computed = (element: Element, property: string): number =>
      parseFloat(getComputedStyle(element).getPropertyValue(property));
    const frame = svg.querySelector('.sigil-renderer__frame');
    const firstStroke = svg.querySelector('path.sigil-renderer__stroke');
    if (frame === null) throw new Error('No framing circle on the sigil.');
    if (firstStroke === null) throw new Error('No stroke on the sigil.');
    const style = getComputedStyle(firstStroke);
    return {
      center: [number(frame, 'cx'), number(frame, 'cy')] as const,
      frameRadius: number(frame, 'r'),
      frameStroke: computed(frame, 'stroke-width'),
      strokeWidth: computed(firstStroke, 'stroke-width'),
      round: style.strokeLinecap === 'round',
      miterLimit: parseFloat(style.strokeMiterlimit),
      strokes: [...svg.querySelectorAll('path.sigil-renderer__stroke')].map((path) =>
        [...(path.getAttribute('d') ?? '').matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map(
          (match) => [Number(match[1]), Number(match[2])] as const,
        ),
      ),
      circles: [...svg.querySelectorAll('circle[data-mark]')].map((circle) => ({
        center: [number(circle, 'cx'), number(circle, 'cy')] as const,
        radius: number(circle, 'r'),
      })),
      bars: [...svg.querySelectorAll('line[data-mark]')].map(
        (line) =>
          [
            [number(line, 'x1'), number(line, 'y1')],
            [number(line, 'x2'), number(line, 'y2')],
          ] as const,
      ),
    };
  });
}

/**
 * Farthest distance from the framing circle's centre reached by the painted ink,
 * stroke thickness, caps and mitred joins included.
 *
 * @param geometry - Geometry read from the page.
 * @returns Distance in frame units.
 */
function inkReach(geometry: InkGeometry): number {
  const { center, strokeWidth, round, miterLimit } = geometry;
  const half = strokeWidth / 2;
  const distance = (point: Point): number => Math.hypot(point[0] - center[0], point[1] - center[1]);
  let reach = 0;
  const unit = (from: Point, to: Point): Point => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    return length === 0 ? [0, 0] : [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
  };
  const offset = (point: Point, normal: Point, side: number, size: number): Point => [
    point[0] + side * normal[0] * size,
    point[1] + side * normal[1] * size,
  ];

  // Cap or join corners at `point` for a line arriving along `incoming` and leaving along `outgoing`.
  const corner = (point: Point, incoming: Point | null, outgoing: Point | null): void => {
    if (round) {
      reach = Math.max(reach, distance(point) + half);
      return;
    }
    for (const direction of [incoming, outgoing]) {
      if (direction === null) continue;
      for (const side of [1, -1]) {
        reach = Math.max(reach, distance(offset(point, [-direction[1], direction[0]], side, half)));
      }
    }
    if (incoming === null || outgoing === null) return;
    const dot = incoming[0] * outgoing[0] + incoming[1] * outgoing[1];
    const ratio = 1 / Math.sqrt(Math.max((1 + dot) / 2, 1e-9));
    if (ratio > miterLimit) return;
    const first: Point = [-incoming[1], incoming[0]];
    const second: Point = [-outgoing[1], outgoing[0]];
    const sum: Point = [first[0] + second[0], first[1] + second[1]];
    const size = half / (1 + first[0] * second[0] + first[1] * second[1]);
    for (const side of [1, -1]) reach = Math.max(reach, distance(offset(point, sum, side, size)));
  };

  for (const stroke of geometry.strokes) {
    stroke.forEach((point, index) => {
      const previous = stroke[index - 1];
      const next = stroke[index + 1];
      corner(
        point,
        previous === undefined ? null : unit(previous, point),
        next === undefined ? null : unit(point, next),
      );
    });
  }
  for (const circle of geometry.circles) {
    reach = Math.max(reach, distance(circle.center) + circle.radius + half);
  }
  for (const [from, to] of geometry.bars) {
    corner(from, null, unit(from, to));
    corner(to, unit(from, to), null);
  }
  return reach;
}

/**
 * Clear gap between the ink and the inner edge of the framing circle.
 *
 * @param geometry - Geometry read from the page.
 * @returns Gap in frame units; negative when the ink touches or crosses the circle.
 */
function frameGap(geometry: InkGeometry): number {
  return geometry.frameRadius - geometry.frameStroke / 2 - inkReach(geometry);
}

/**
 * Clear gap between the last loop and the end bar of a kamea, edge to edge.
 *
 * @param geometry - Geometry read from the page, with at least one loop and the end bar.
 * @returns Gap in frame units; negative when the two marks touch.
 * @throws {Error} When the sigil has no loop or no end bar.
 */
function loopToBarGap(geometry: InkGeometry): number {
  const loops = geometry.circles.slice(1);
  const loop = loops[loops.length - 1];
  const bar = geometry.bars[0];
  if (loop === undefined || bar === undefined) throw new Error('No final loop or end bar.');
  const [[ax, ay], [bx, by]] = bar;
  const [px, py] = loop.center;
  const lengthSquared = (bx - ax) ** 2 + (by - ay) ** 2;
  const along = Math.min(
    1,
    Math.max(0, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / lengthSquared),
  );
  const distance = Math.hypot(px - (ax + along * (bx - ax)), py - (ay + along * (by - ay)));
  // Both marks share the ink's stroke width: half of it on each side of the centrelines.
  return distance - loop.radius - geometry.strokeWidth;
}

/**
 * Coordinates of a path, flattened.
 *
 * @param data - The `d` attribute of a polyline path.
 * @returns Every number in it, in order.
 */
function coordinates(data: string): number[] {
  return [...data.matchAll(/-?[\d.]+/g)].map((match) => Number(match[0]));
}

/**
 * Number of segments of the kamea path shown.
 *
 * @param page - Page showing a kamea.
 * @returns Count of `L` commands.
 */
async function drawnSegments(page: Page): Promise<number> {
  const d = await sigil(page).locator('path.sigil-renderer__stroke').getAttribute('d');
  return (d?.match(/L/g) ?? []).length;
}

test.describe('scenario 1: the sigil traces itself in path order, then the marks appear', () => {
  test('kamea "Je suis calme" on Saturn: start mark, path, end mark', async ({ page }) => {
    await collectCspViolations(page);
    await page.goto('./');
    await trace(page);
    await expect(sigil(page)).toHaveClass(/sigil-renderer--trace/);
    await shot(page, 's1-kamea-t0');

    const animations = await sigilAnimations(page);
    const start = animations.find((a) => a.target.includes('mark--before'));
    const stroke = animations.find((a) => a.name.endsWith('draw'));
    const end = animations.find((a) => a.target.includes('mark--after'));
    expect(start, 'start mark fade').toBeDefined();
    expect(stroke, 'path drawing').toBeDefined();
    expect(end, 'end mark fade').toBeDefined();
    // Start mark first, path once it is there, end mark only once the path is whole.
    expect(stroke?.delay).toBeGreaterThanOrEqual(start?.endTime ?? Infinity);
    expect(end?.delay).toBeGreaterThanOrEqual(stroke?.endTime ?? Infinity);

    // The dash offset only goes down: the path is revealed from its first point to its last.
    const path = sigil(page).locator('path.sigil-renderer__stroke');
    const endBar = sigil(page).locator('[data-mark="end-bar"]');
    const offsetOf = (): Promise<number> =>
      path.evaluate((element) =>
        Number(getComputedStyle(element).strokeDashoffset.replace('px', '')),
      );
    const opacityOf = (locator: Locator): Promise<number> =>
      locator.evaluate((element) => Number(getComputedStyle(element).opacity));

    await page.waitForTimeout(500);
    const early = await offsetOf();
    await shot(page, 's1-kamea-t500');
    await page.waitForTimeout(700);
    const middle = await offsetOf();
    expect(await opacityOf(endBar), 'end bar hidden while the path is being drawn').toBe(0);
    await shot(page, 's1-kamea-t1200');
    await page.waitForTimeout(700);
    const late = await offsetOf();
    await shot(page, 's1-kamea-t1900');
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(1);
    expect(middle).toBeLessThan(early);
    expect(late).toBeLessThan(middle);

    await expect.poll(() => opacityOf(endBar), { timeout: 4000 }).toBe(1);
    expect(await offsetOf()).toBe(0);
    await shot(page, 's1-kamea-final');
    expect(await cspViolations(page)).toEqual([]);
  });

  test('Spare strokes follow one another in order, at a constant speed', async ({ page }) => {
    await page.goto('./');
    await traceSpare(page, CALM);
    await expect(sigil(page)).toHaveClass(/sigil-renderer--trace/);
    await shot(page, 's1-spare-t0');

    const strokes = (await sigilAnimations(page)).filter((a) => a.name.endsWith('draw'));
    expect(strokes.length).toBeGreaterThan(1);
    for (let index = 1; index < strokes.length; index += 1) {
      // Each stroke starts after the previous one has ended: path order, with a pen lift between.
      expect(strokes[index]?.delay ?? 0).toBeGreaterThan(strokes[index - 1]?.endTime ?? Infinity);
    }
    // Constant speed: duration proportional to the geometric length (within 5 %).
    const speeds = strokes.map((a) => a.duration / a.length);
    const mean = speeds.reduce((sum, value) => sum + value, 0) / speeds.length;
    for (const speed of speeds) expect(Math.abs(speed - mean) / mean).toBeLessThan(0.05);
    await page.waitForTimeout(1500);
    await shot(page, 's1-spare-t1500');
    await expect(sigil(page).locator('path.sigil-renderer__stroke')).toHaveCount(strokes.length);
  });
});

test.describe('scenario 2: reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the sigil appears at once, without any tracing animation', async ({ page }) => {
    await page.goto('./');
    await trace(page);
    await expect(sigil(page)).toHaveClass(/sigil-renderer--static/);
    await expect(sigil(page)).not.toHaveClass(/sigil-renderer--trace/);
    await shot(page, 's2-reduced-kamea');

    // No path drawing, whatever the moment.
    expect((await sigilAnimations(page)).filter((a) => a.name.endsWith('draw'))).toEqual([]);
    await expect(sigil(page).locator('[pathLength]')).toHaveCount(0);
    const path = sigil(page).locator('path.sigil-renderer__stroke');
    const dash = await path.evaluate((element) => getComputedStyle(element).strokeDasharray);
    expect(['none', '0px', '']).toContain(dash);
    // The end mark is there as soon as the 150 ms fade is over.
    await page.waitForTimeout(250);
    await expect(sigil(page).locator('[data-mark="end-bar"]')).toHaveCSS('opacity', '1');
    // Only the 150 ms fade of design.md remains: no tracing, no pen movement.
    expect((await sigilAnimations(page)).map((a) => a.name)).toEqual(['sigil-renderer-fade']);
  });

  test('Spare also appears at once, whole', async ({ page }) => {
    await page.goto('./');
    await traceSpare(page, CALM);
    await expect(sigil(page)).toHaveClass(/sigil-renderer--static/);
    expect((await sigilAnimations(page)).filter((a) => a.name.endsWith('draw'))).toEqual([]);
    await shot(page, 's2-reduced-spare');
  });
});

test.describe('scenario 3: style changes redraw without changing the shape', () => {
  test('width, line ends and framing circle update the render; shape kept; no replay', async ({
    page,
  }) => {
    await collectCspViolations(page);
    await page.goto('./');
    await trace(page);
    const run = await runKey(page);
    const ink = sigil(page).locator('[data-run]');
    const path = sigil(page).locator('path.sigil-renderer__stroke');
    const shape = await path.getAttribute('d');
    await shot(page, 's3-start');

    // Remember the very animation objects, to prove none is recreated.
    await page.evaluate(() => {
      Object.assign(window, { before: document.getAnimations() });
    });
    await page.waitForTimeout(600);
    for (const width of STROKE_WIDTHS) {
      await setStrokeWidth(page, width);
      await expect(ink).toHaveAttribute('stroke-width', String(width));
      expect(await path.getAttribute('d')).toBe(shape);
    }
    await setStrokeWidth(page, 2.4);
    await shot(page, 's3-width-2.4');

    await page.getByRole('switch', { name: 'Extrémités arrondies' }).click({ force: true });
    await expect(ink).toHaveAttribute('stroke-linecap', 'butt');
    await expect(ink).toHaveAttribute('stroke-linejoin', 'miter');
    expect(await path.getAttribute('d')).toBe(shape);
    await shot(page, 's3-butt-ends');
    await page.getByRole('switch', { name: 'Extrémités arrondies' }).click({ force: true });
    await expect(ink).toHaveAttribute('stroke-linecap', 'round');

    await setFrame(page, true);
    await expect(sigil(page).locator('.sigil-renderer__frame')).toHaveCount(1);
    // Same shape, smaller: every point stays on its ray from the centre, scaled by one factor.
    const framed = coordinates((await path.getAttribute('d')) ?? '');
    const original = coordinates(shape ?? '');
    expect(framed).toHaveLength(original.length);
    const [cx, cy] = (await inkGeometry(page)).center;
    const around = (values: number[]): number[] =>
      values.map((value, index) => value - (index % 2 === 0 ? cx : cy));
    const moved = around(framed);
    const base = around(original);
    const scale =
      moved.reduce((sum, value, index) => sum + value * (base[index] ?? 0), 0) /
      base.reduce((sum, value) => sum + value * value, 0);
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThanOrEqual(1);
    moved.forEach((value, index) => {
      expect(Math.abs(value - scale * (base[index] ?? 0))).toBeLessThan(0.01);
    });
    await shot(page, 's3-frame');

    await setFrame(page, false);
    await expect(sigil(page).locator('.sigil-renderer__frame')).toHaveCount(0);
    await setStrokeWidth(page, 1.2);
    expect(await path.getAttribute('d')).toBe(shape);

    // Nothing replayed: same run key, and no animation of the start was cancelled.
    expect(await runKey(page)).toBe(run);
    const cancelled = await page.evaluate(() => {
      const before = (window as unknown as { before: Animation[] }).before;
      return before.filter((animation) => animation.playState === 'idle').length;
    });
    expect(cancelled).toBe(0);
    expect(await cspViolations(page)).toEqual([]);
  });

  test('a style change in the middle of the tracing does not restart it', async ({ page }) => {
    await page.goto('./');
    await trace(page);
    await page.waitForTimeout(1000);
    const before = (await sigilAnimations(page)).find((a) => a.name.endsWith('draw'));
    await setStrokeWidth(page, 2);
    await page.getByRole('switch', { name: 'Extrémités arrondies' }).click({ force: true });
    await setFrame(page, true);
    const after = (await sigilAnimations(page)).find((a) => a.name.endsWith('draw'));
    expect(before?.currentTime).toBeGreaterThanOrEqual(1000);
    // Time only moves forward: a restart would bring it back near 0.
    expect(after?.currentTime ?? 0).toBeGreaterThanOrEqual(before?.currentTime ?? Infinity);
  });
});

test.describe('scenario 4: "Rejouer" restarts the animation', () => {
  test('after the end, and during the tracing', async ({ page }) => {
    await page.goto('./');
    await trace(page);
    const first = await runKey(page);
    await expect
      .poll(async () => (await sigilAnimations(page)).every((a) => a.currentTime >= a.endTime), {
        timeout: 5000,
      })
      .toBe(true);
    await shot(page, 's4-before-replay');

    await page.getByRole('button', { name: 'Rejouer' }).click();
    const second = await runKey(page);
    expect(second).not.toBe(first);
    const restarted = (await sigilAnimations(page)).find((a) => a.name.endsWith('draw'));
    expect(restarted?.currentTime ?? Infinity).toBeLessThan(600);
    await expect(sigil(page)).toHaveClass(/sigil-renderer--trace/);
    const path = sigil(page).locator('path.sigil-renderer__stroke');
    await page.waitForTimeout(500);
    const offset = await path.evaluate((element) =>
      Number(getComputedStyle(element).strokeDashoffset.replace('px', '')),
    );
    expect(offset).toBeGreaterThan(0);
    await shot(page, 's4-replaying');

    // Again, in the middle of the tracing.
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Rejouer' }).click();
    expect(await runKey(page)).not.toBe(second);
    const again = (await sigilAnimations(page)).find((a) => a.name.endsWith('draw'));
    expect(again?.currentTime ?? Infinity).toBeLessThan(600);
    expect(await sigil(page).getAttribute('aria-label')).toBe('Sigil kamea de Saturne');
  });

  test('replays the same shape, and a double click leaves a single tracing', async ({ page }) => {
    await page.goto('./');
    await traceSpare(page, CALM);
    const paths = sigil(page).locator('path.sigil-renderer__stroke');
    const shape = await paths.evaluateAll((all) => all.map((p) => p.getAttribute('d')));
    await page.getByRole('button', { name: 'Rejouer' }).dblclick();
    expect(await paths.evaluateAll((all) => all.map((p) => p.getAttribute('d')))).toEqual(shape);
    const draws = (await sigilAnimations(page)).filter((a) => a.name.endsWith('draw'));
    expect(draws).toHaveLength(shape.length);
  });
});

test.describe('total tracing time (D19, T19)', () => {
  for (const planet of PLANETS) {
    test(`kamea ${planet}, "${BELLE_ALLEE}": at most 3 s without the circle`, async ({ page }) => {
      await page.goto('./');
      await page.getByLabel('Intention').fill(BELLE_ALLEE);
      await page.getByRole('radio', { name: planet }).check({ force: true });
      const wall = await timeTracing(page);
      const scheduled = tracingEnd(await sigilAnimations(page));
      test.info().annotations.push({
        type: 'duration',
        description: `scheduled ${String(Math.round(scheduled))} ms, wall clock ${String(Math.round(wall))} ms`,
      });
      expect(scheduled).toBeLessThanOrEqual(TRACE_BUDGET_MS);
      expect(wall).toBeLessThanOrEqual(TRACE_BUDGET_MS + WALL_CLOCK_MARGIN_MS);
    });
  }

  test('Spare with an intention of more than 120 letters: at most 3 s', async ({ page }) => {
    expect(LONG_INTENTION.replace(/[^a-z]/gi, '').length).toBeGreaterThan(120);
    await page.goto('./');
    await page.getByText('Spare', { exact: true }).click();
    await page.getByLabel('Intention').fill(LONG_INTENTION);
    const wall = await timeTracing(page);
    const animations = await sigilAnimations(page);
    const scheduled = tracingEnd(animations);
    test.info().annotations.push({
      type: 'duration',
      description: `${String(animations.length)} animations, scheduled ${String(Math.round(scheduled))} ms, wall clock ${String(Math.round(wall))} ms`,
    });
    await shot(page, 'duration-spare-long-final');
    expect(scheduled).toBeLessThanOrEqual(TRACE_BUDGET_MS);
    expect(wall).toBeLessThanOrEqual(TRACE_BUDGET_MS + WALL_CLOCK_MARGIN_MS);
    // Order is kept after the speed-up: every stroke still starts after the previous one ends.
    const strokes = animations.filter((a) => a.name.endsWith('draw'));
    for (let index = 1; index < strokes.length; index += 1) {
      expect(strokes[index]?.delay ?? 0).toBeGreaterThan(strokes[index - 1]?.endTime ?? Infinity);
    }
  });

  test('the framing circle comes after, and does not delay the sigil', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('switch', { name: 'Cercle d’encadrement' }).check({ force: true });
    await trace(page);
    const animations = await sigilAnimations(page);
    const frame = animations.find((a) => a.target.includes('frame'));
    expect(frame, 'framing circle drawing').toBeDefined();
    expect(frame?.delay).toBeGreaterThanOrEqual(tracingEnd(animations));
    expect(tracingEnd(animations)).toBeLessThanOrEqual(TRACE_BUDGET_MS);
  });
});

test.describe('stroke width 0.4 to 2.4', () => {
  test('the slider spans the range, and the drawing follows at both ends', async ({ page }) => {
    await page.goto('./');
    await trace(page);
    const slider = page.getByRole('slider', { name: 'Épaisseur' });
    await expect(slider).toHaveAttribute('min', '0.4');
    await expect(slider).toHaveAttribute('max', '2.4');
    const ink = sigil(page).locator('[data-run]');

    await setStrokeWidth(page, 0.4);
    await expect(ink).toHaveAttribute('stroke-width', '0.4');
    await expect(slider).toHaveAttribute('aria-valuetext', /^0,4, fin/);
    await shot(page, 'width-0.4');
    await setStrokeWidth(page, 2.4);
    await expect(ink).toHaveAttribute('stroke-width', '2.4');
    await expect(slider).toHaveAttribute('aria-valuetext', /^2,4, épais/);
    await shot(page, 'width-2.4');
    // Out of range: the browser clamps it, the drawing never exceeds 2.4.
    await slider.evaluate((input: HTMLInputElement) => {
      input.value = '4';
    });
    expect(await slider.inputValue()).toBe('2.4');
  });
});

test.describe('the drawing stays inside the framing circle, with a visible gap', () => {
  for (const planet of PLANETS) {
    test(`kamea ${planet}, "${BELLE_ALLEE}"`, async ({ page }) => {
      await page.goto('./');
      await traceKamea(page, planet, BELLE_ALLEE);
      await setFrame(page, true);
      const gaps: string[] = [];
      for (const width of STROKE_WIDTHS) {
        await setStrokeWidth(page, width);
        const gap = frameGap(await inkGeometry(page));
        gaps.push(`${String(width)} → ${gap.toFixed(2)}`);
        expect(gap, `width ${String(width)}`).toBeGreaterThanOrEqual(MIN_FRAME_GAP);
      }
      test.info().annotations.push({ type: 'gap', description: gaps.join(', ') });
      await shot(page, `frame-kamea-${planet.split(' ')[0] ?? planet}`);
    });
  }

  test('kamea with square line ends (butt caps, mitred joins)', async ({ page }) => {
    await page.goto('./');
    await traceKamea(page, 'Lune 9×9', BELLE_ALLEE);
    await setFrame(page, true);
    await page.getByRole('switch', { name: 'Extrémités arrondies' }).click({ force: true });
    await setStrokeWidth(page, 2.4);
    expect(frameGap(await inkGeometry(page))).toBeGreaterThanOrEqual(MIN_FRAME_GAP);
  });

  for (const [label, intention] of [
    ['short', CALM],
    ['long', LONG_INTENTION],
  ] as const) {
    test(`Spare, ${label} intention, three variants`, async ({ page }) => {
      await page.goto('./');
      await traceSpare(page, intention);
      await setFrame(page, true);
      for (let variant = 1; variant <= 3; variant += 1) {
        if (variant > 1) await page.getByRole('button', { name: /autre variante/i }).click();
        const gaps: string[] = [];
        for (const width of STROKE_WIDTHS) {
          await setStrokeWidth(page, width);
          const gap = frameGap(await inkGeometry(page));
          gaps.push(`v${String(variant)} ${String(width)} → ${gap.toFixed(2)}`);
          expect(gap, `variant ${String(variant)}, width ${String(width)}`).toBeGreaterThanOrEqual(
            MIN_FRAME_GAP,
          );
        }
        test.info().annotations.push({ type: 'gap', description: gaps.join(', ') });
        await shot(page, `frame-spare-${label}-v${String(variant)}`);
      }
    });
  }
});

test.describe('the final kamea loop does not touch the end bar (T17)', () => {
  for (const planet of ['Lune 9×9', 'Saturne 3×3']) {
    test(`${planet}, "${BELLE_ALLEE}", widths 0.4 to 2.4`, async ({ page }) => {
      await page.goto('./');
      await traceKamea(page, planet, BELLE_ALLEE);
      await expect(sigil(page).locator('[data-mark="loop"]').first()).toBeAttached();
      await setFrame(page, true);
      const gaps: string[] = [];
      for (const width of [0.4, 0.8, 1.2, 1.6, 2, 2.4]) {
        await setStrokeWidth(page, width);
        const gap = loopToBarGap(await inkGeometry(page));
        gaps.push(`${String(width)} → ${gap.toFixed(2)}`);
        expect(gap, `width ${String(width)}`).toBeGreaterThan(0);
      }
      test.info().annotations.push({ type: 'gap', description: gaps.join(', ') });
      await setStrokeWidth(page, 2.4);
      await shot(page, `loop-${planet.split(' ')[0] ?? planet}-2.4`);
    });
  }
});

test.describe('reduced motion: step-by-step replay', () => {
  test.use({ reducedMotion: 'reduce' });

  test('each click on "Rejouer" adds one step, the final loop comes with the last one', async ({
    page,
  }) => {
    await page.goto('./');
    await traceKamea(page, 'Lune 9×9', BELLE_ALLEE);
    const path = sigil(page).locator('path.sigil-renderer__stroke');
    const whole = (await path.getAttribute('d')) ?? '';
    const segments = await drawnSegments(page);
    const replay = page.getByRole('button', { name: 'Rejouer' });
    const status = page.getByText(/^Pas à pas : étape \d+ sur \d+/).first();
    const loops = sigil(page).locator('[data-mark="loop"]');
    await expect(loops).toHaveCount(2);

    await replay.click();
    await expect(status).toContainText('étape 1 sur');
    const total = Number(/sur (\d+)/.exec((await status.textContent()) ?? '')?.[1]);
    expect(total).toBe(segments);
    await shot(page, 'steps-1');
    expect(await drawnSegments(page)).toBe(1);
    await expect(loops).not.toHaveCount(2);

    for (let step = 2; step <= total; step += 1) {
      await replay.click();
      await expect(status).toContainText(`étape ${String(step)} sur ${String(total)}`);
      expect(await drawnSegments(page), `step ${String(step)}`).toBe(step);
      // Each step is a prefix of the whole path: same order as the animated tracing.
      expect(whole.startsWith((await path.getAttribute('d')) ?? 'x')).toBe(true);
      if (step < total) {
        // A loop on the way may show once the path reaches it; the final loop and the end bar wait.
        await expect(loops, `final loop at step ${String(step)}`).not.toHaveCount(2);
        await expect(sigil(page).locator('[data-mark="end-bar"]')).toHaveCount(0);
      }
    }
    // Last step: the whole path, the end bar and every loop, final loop included.
    expect(await path.getAttribute('d')).toBe(whole);
    await expect(loops).toHaveCount(2);
    await expect(sigil(page).locator('[data-mark="end-bar"]')).toHaveCount(1);
    await expect(status).toContainText('sigil complet');
    await shot(page, 'steps-last');
    expect((await sigilAnimations(page)).filter((a) => a.name.endsWith('draw'))).toEqual([]);
  });

  test('a style change keeps the current step', async ({ page }) => {
    await page.goto('./');
    await trace(page);
    const replay = page.getByRole('button', { name: 'Rejouer' });
    await replay.click();
    await replay.click();
    const status = page.getByText(/^Pas à pas : étape \d+ sur \d+/).first();
    await expect(status).toContainText('étape 2 sur');
    const path = sigil(page).locator('path.sigil-renderer__stroke');
    const partial = await path.getAttribute('d');
    await setStrokeWidth(page, 2);
    await page.getByRole('switch', { name: 'Extrémités arrondies' }).click({ force: true });
    await expect(status).toContainText('étape 2 sur');
    expect(await path.getAttribute('d')).toBe(partial);
  });

  test('Spare: steps then the whole sigil', async ({ page }) => {
    await page.goto('./');
    await traceSpare(page, CALM);
    const paths = sigil(page).locator('path.sigil-renderer__stroke');
    const full = await paths.evaluateAll((all) => all.map((p) => p.getAttribute('d')));
    const replay = page.getByRole('button', { name: 'Rejouer' });
    await replay.click();
    const status = page.getByText(/^Pas à pas : étape \d+ sur \d+/).first();
    await expect(status).toContainText('étape 1 sur');
    const total = Number(/sur (\d+)/.exec((await status.textContent()) ?? '')?.[1]);
    expect(total).toBeGreaterThan(1);
    for (let step = 2; step <= total; step += 1) await replay.click();
    await expect(status).toContainText('sigil complet');
    expect(await paths.evaluateAll((all) => all.map((p) => p.getAttribute('d')))).toEqual(full);
    await shot(page, 'steps-spare-last');
  });
});

test.describe('strict CSP (D12)', () => {
  test('no violation across a full session, and no inline style in the built page', async ({
    page,
  }) => {
    const consoleMessages: string[] = [];
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) consoleMessages.push(message.text());
    });
    page.on('pageerror', (error) => consoleMessages.push(error.message));
    await collectCspViolations(page);
    await page.goto('./');
    await trace(page);
    await setStrokeWidth(page, 2.4);
    await setFrame(page, true);
    await page.getByRole('switch', { name: 'Extrémités arrondies' }).click({ force: true });
    await page.getByRole('button', { name: 'Rejouer' }).click();
    await traceSpare(page, LONG_INTENTION);
    await page.getByRole('button', { name: /autre variante/i }).click();
    await page.getByRole('button', { name: 'Rejouer' }).click();
    await page.waitForTimeout(3300);

    expect(await cspViolations(page)).toEqual([]);
    expect(consoleMessages.filter((text) => /content security policy|refused/i.test(text))).toEqual(
      [],
    );
    const csp = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(await page.locator('style').count()).toBe(0);
    // Dynamic values go through the CSSOM: the HTML source carries no `style=""` attribute.
    const source = (await (await page.request.get('./')).text()).replace(/<!--[\s\S]*?-->/g, '');
    expect(source).not.toMatch(/<[a-z][^>]*\sstyle=/i);
  });
});

test.describe('375 px layout', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('no horizontal scroll, the sigil and the Style panel fit, controls are reachable', async ({
    page,
  }) => {
    await page.goto('./');
    await trace(page);
    await shot(page, 'mobile-375-sigil');
    const box = await sigil(page).boundingBox();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);

    const summary = page.locator('summary', { hasText: 'Style' });
    await summary.scrollIntoViewIfNeeded();
    await summary.click();
    await expect(page.getByRole('slider', { name: 'Épaisseur' })).toBeVisible();
    await setFrame(page, true);
    await page.getByRole('slider', { name: 'Épaisseur' }).scrollIntoViewIfNeeded();
    await shot(page, 'mobile-375-style-open');

    for (const control of [
      page.getByRole('slider', { name: 'Épaisseur' }),
      page.getByRole('switch', { name: 'Extrémités arrondies' }),
      page.getByRole('switch', { name: 'Cercle d’encadrement' }),
      page.getByRole('button', { name: 'Rejouer' }),
    ]) {
      await control.scrollIntoViewIfNeeded();
      const target = await control.evaluate((element) => {
        // A visually hidden switch is operated through its label; the slider and the button are the target.
        const isSwitch = element.getAttribute('role') === 'switch';
        const labelled = isSwitch
          ? ((element as HTMLInputElement).labels?.[0] ?? element)
          : element;
        const rect = labelled.getBoundingClientRect();
        return { left: rect.left, right: rect.right, height: rect.height };
      });
      expect(target.left).toBeGreaterThanOrEqual(0);
      expect(target.right).toBeLessThanOrEqual(375);
      // Touch target at least 44 px high (conventions-ui).
      expect(target.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);

    // Spare, long intention, framed: still inside the viewport.
    await traceSpare(page, LONG_INTENTION);
    await sigil(page).scrollIntoViewIfNeeded();
    const spareBox = await sigil(page).boundingBox();
    expect((spareBox?.x ?? -1) + (spareBox?.width ?? 0)).toBeLessThanOrEqual(375);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    await shot(page, 'mobile-375-spare');
  });
});

test.describe('keyboard use of the Style panel', () => {
  test('slider, switches and "Rejouer" work without a pointer, with a visible focus', async ({
    page,
  }) => {
    await page.goto('./');
    await trace(page);
    const slider = page.getByRole('slider', { name: 'Épaisseur' });
    const roundEnds = page.getByRole('switch', { name: 'Extrémités arrondies' });
    const frame = page.getByRole('switch', { name: 'Cercle d’encadrement' });
    const ink = sigil(page).locator('[data-run]');

    await slider.focus();
    await shot(page, 'keyboard-slider-focus');
    await page.keyboard.press('Home');
    await expect(ink).toHaveAttribute('stroke-width', '0.4');
    await page.keyboard.press('ArrowRight');
    await expect(ink).toHaveAttribute('stroke-width', '0.6');
    await page.keyboard.press('ArrowUp');
    await expect(ink).toHaveAttribute('stroke-width', '0.8');
    await page.keyboard.press('ArrowLeft');
    await expect(ink).toHaveAttribute('stroke-width', '0.6');
    await page.keyboard.press('End');
    await expect(ink).toHaveAttribute('stroke-width', '2.4');
    await page.keyboard.press('ArrowRight');
    await expect(ink).toHaveAttribute('stroke-width', '2.4');

    await page.keyboard.press('Tab');
    await expect(roundEnds).toBeFocused();
    await shot(page, 'keyboard-switch-focus');
    await page.keyboard.press('Space');
    await expect(ink).toHaveAttribute('stroke-linecap', 'butt');
    await page.keyboard.press('Space');
    await expect(ink).toHaveAttribute('stroke-linecap', 'round');

    await page.keyboard.press('Tab');
    await expect(frame).toBeFocused();
    await page.keyboard.press('Space');
    await expect(sigil(page).locator('.sigil-renderer__frame')).toHaveCount(1);
    await page.keyboard.press('Space');
    await expect(sigil(page).locator('.sigil-renderer__frame')).toHaveCount(0);

    // A replay by keyboard.
    const replay = page.getByRole('button', { name: 'Rejouer' });
    await replay.focus();
    const first = await runKey(page);
    await page.keyboard.press('Enter');
    expect(await runKey(page)).not.toBe(first);
    const second = await runKey(page);
    await page.keyboard.press('Space');
    expect(await runKey(page)).not.toBe(second);

    // The Style section itself opens and closes from the keyboard.
    const summary = page.locator('summary', { hasText: 'Style' });
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(slider).toBeHidden();
    await page.keyboard.press('Enter');
    await expect(slider).toBeVisible();
  });

  test('focus indicators are visible on the slider and the switches', async ({ page }) => {
    await page.goto('./');
    await trace(page);
    await page.getByRole('slider', { name: 'Épaisseur' }).focus();
    await page.keyboard.press('Tab');
    const visible = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement;
      const track = active.closest('label')?.querySelector('.switch__track, .switch__control');
      const own = getComputedStyle(active);
      const related = track === null || track === undefined ? null : getComputedStyle(track);
      return {
        ownOutline: `${own.outlineStyle} ${own.outlineWidth}`,
        relatedOutline: related === null ? '' : `${related.outlineStyle} ${related.outlineWidth}`,
        focusVisible: active.matches(':focus-visible'),
      };
    });
    test.info().annotations.push({ type: 'focus', description: JSON.stringify(visible) });
    expect(visible.focusVisible).toBe(true);
  });
});
