/**
 * Acceptance spec of feature F1 (kamea sigil), written by the tester from the
 * five scenarios of the plan plus edge cases: loops, determinism across
 * reloads, the seven squares against Agrippa's values (typed here
 * independently of the app source), business errors, the single-word rule
 * (D18), privacy (D8), strict CSP (D12), 375 px layout and keyboard use.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

/** Agrippa's seven squares, row by row, keyed by the French planet name. */
const AGRIPPA: Readonly<Record<string, readonly (readonly number[])[]>> = {
  Saturne: [
    [4, 9, 2],
    [3, 5, 7],
    [8, 1, 6],
  ],
  Jupiter: [
    [4, 14, 15, 1],
    [9, 7, 6, 12],
    [5, 11, 10, 8],
    [16, 2, 3, 13],
  ],
  Mars: [
    [11, 24, 7, 20, 3],
    [4, 12, 25, 8, 16],
    [17, 5, 13, 21, 9],
    [10, 18, 1, 14, 22],
    [23, 6, 19, 2, 15],
  ],
  Soleil: [
    [6, 32, 3, 34, 35, 1],
    [7, 11, 27, 28, 8, 30],
    [19, 14, 16, 15, 23, 24],
    [18, 20, 22, 21, 17, 13],
    [25, 29, 10, 9, 26, 12],
    [36, 5, 33, 4, 2, 31],
  ],
  Vénus: [
    [22, 47, 16, 41, 10, 35, 4],
    [5, 23, 48, 17, 42, 11, 29],
    [30, 6, 24, 49, 18, 36, 12],
    [13, 31, 7, 25, 43, 19, 37],
    [38, 14, 32, 1, 26, 44, 20],
    [21, 39, 8, 33, 2, 27, 45],
    [46, 15, 40, 9, 34, 3, 28],
  ],
  Mercure: [
    [8, 58, 59, 5, 4, 62, 63, 1],
    [49, 15, 14, 52, 53, 11, 10, 56],
    [41, 23, 22, 44, 45, 19, 18, 48],
    [32, 34, 35, 29, 28, 38, 39, 25],
    [40, 26, 27, 37, 36, 30, 31, 33],
    [17, 47, 46, 20, 21, 43, 42, 24],
    [9, 55, 54, 12, 13, 51, 50, 16],
    [64, 2, 3, 61, 60, 6, 7, 57],
  ],
  Lune: [
    [37, 78, 29, 70, 21, 62, 13, 54, 5],
    [6, 38, 79, 30, 71, 22, 63, 14, 46],
    [47, 7, 39, 80, 31, 72, 23, 55, 15],
    [16, 48, 8, 40, 81, 32, 64, 24, 56],
    [57, 17, 49, 9, 41, 73, 33, 65, 25],
    [26, 58, 18, 50, 1, 42, 74, 34, 66],
    [67, 27, 59, 10, 51, 2, 43, 75, 35],
    [36, 68, 19, 60, 11, 52, 3, 44, 76],
    [77, 28, 69, 20, 61, 12, 53, 4, 45],
  ],
};

/**
 * The sigil drawn on the scene (not the grid of the panel).
 *
 * @param page - Page on the app.
 * @returns Locator of the scene sigil.
 */
const sigilOf = (page: Page): Locator => page.getByRole('img', { name: /^Sigil kamea/ });

/**
 * Picks a planet, types the intention and presses "Tracer".
 *
 * @param page - Page on the app.
 * @param intention - Text to type.
 * @param planet - French planet name as shown on the picker.
 */
async function trace(page: Page, intention: string, planet = 'Saturne'): Promise<void> {
  await page.getByLabel('Intention').fill(intention);
  await page.getByRole('radio', { name: new RegExp(`^${planet}`) }).check({ force: true });
  await page.getByRole('button', { name: 'Tracer' }).click();
}

/**
 * Sigil markup without the run counter that numbers the sigils shown.
 *
 * @param page - Page showing a sigil.
 * @returns The `<svg>` outer HTML.
 */
async function sigilMarkup(page: Page): Promise<string> {
  const markup = await sigilOf(page).evaluate((svg) => svg.outerHTML);
  return markup.replace(/data-run="[^"]*"/g, '');
}

/**
 * Names of the marks of the sigil, in document order.
 *
 * @param page - Page showing a sigil.
 * @returns Values of `data-mark`.
 */
function marksOf(page: Page): Promise<(string | undefined)[]> {
  return sigilOf(page).evaluate((svg) =>
    Array.from(svg.querySelectorAll<SVGElement>('[data-mark]')).map((mark) => mark.dataset.mark),
  );
}

test.describe('scenario 1 - "Calme" on Saturn', () => {
  test('joins cells 3,1,3,4,5 with a start circle and a perpendicular end bar', async ({
    page,
  }) => {
    await page.goto('./');
    await trace(page, 'Calme');
    await expect(sigilOf(page)).toBeVisible();

    await expect(
      page.getByRole('img', {
        name: 'Carré de Saturne, 3 × 3, avec le chemin : 3, 1, 3, 4, 5',
      }),
    ).toBeVisible();
    await expect(page.getByText('Cases : 3 → 1 → 3 → 4 → 5')).toBeVisible();

    const geometry = await sigilOf(page).evaluate((svg) => {
      const d = svg.querySelector('path')?.getAttribute('d') ?? '';
      const points = Array.from(d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)).map((m) => [
        Number(m[1]),
        Number(m[2]),
      ]);
      const bar = svg.querySelector('[data-mark="end-bar"]');
      const circle = svg.querySelector('[data-mark="start-circle"]');
      return {
        points,
        bar: ['x1', 'y1', 'x2', 'y2'].map((name) => Number(bar?.getAttribute(name))),
        circle: [Number(circle?.getAttribute('cx')), Number(circle?.getAttribute('cy'))],
      };
    });
    expect(geometry.points).toHaveLength(5);
    // The circle sits on the first point of the path.
    expect(geometry.circle).toEqual(geometry.points[0]);
    // The bar is centred on the last point and perpendicular to the last segment.
    const [x1, y1, x2, y2] = geometry.bar as [number, number, number, number];
    const last = geometry.points[4] as [number, number];
    const before = geometry.points[3] as [number, number];
    expect((x1 + x2) / 2).toBeCloseTo(last[0], 1);
    expect((y1 + y2) / 2).toBeCloseTo(last[1], 1);
    const dot = (x2 - x1) * (last[0] - before[0]) + (y2 - y1) * (last[1] - before[1]);
    expect(Math.abs(dot)).toBeLessThan(0.01);
    expect(await marksOf(page)).toEqual(['start-circle', 'end-bar']);
  });
});

test.describe('scenario 2 - loops', () => {
  test('marks a case reached twice in a row with a loop', async ({ page }) => {
    await page.goto('./');
    await trace(page, 'AAB');
    expect(await marksOf(page)).toEqual(['start-circle', 'loop', 'end-bar']);
  });

  test('draws one loop per case on "Allée" on the Moon (L-L and E-E)', async ({ page }) => {
    await page.goto('./');
    await trace(page, 'Allée', 'Lune');
    const loops = (await marksOf(page)).filter((mark) => mark === 'loop');
    expect(loops).toHaveLength(2);
  });

  test('has no loop when no two consecutive letters share a number', async ({ page }) => {
    await page.goto('./');
    await trace(page, 'Été');
    expect(await marksOf(page)).toEqual(['start-circle', 'end-bar']);
  });

  test('refuses an intention whose letters all land on one cell ("Aa", "AJ" on Saturn)', async ({
    page,
  }) => {
    await page.goto('./');
    for (const text of ['Aa', 'AJ']) {
      await trace(page, text);
      await expect(page.getByText(/Toutes les lettres tombent sur la case 1/)).toBeVisible();
      await expect(sigilOf(page)).toHaveCount(0);
    }
  });
});

test.describe('scenario 3 - determinism', () => {
  for (const [text, planet] of [
    ['Calme', 'Saturne'],
    ['Allée', 'Lune'],
    ['Garçonnière', 'Mars'],
    ['Cœur', 'Vénus'],
  ] as const) {
    test(`gives the same SVG after a reload: "${text}" on ${planet}`, async ({ page }) => {
      await page.goto('./');
      await trace(page, text, planet);
      const first = await sigilMarkup(page);
      await page.reload();
      await trace(page, text, planet);
      expect(await sigilMarkup(page)).toBe(first);
      // Tracing again without reloading gives the same shape too.
      await page.getByRole('button', { name: 'Tracer' }).click();
      expect(await sigilMarkup(page)).toBe(first);
    });
  }
});

test.describe('scenario 4 - "how it is made" panel', () => {
  test('shows the rule, the letter table and the square with the path', async ({ page }) => {
    await page.goto('./');
    await trace(page, 'Calme');
    await expect(page.getByText('Règle de conversion')).toBeVisible();
    await expect(page.getByText('nombre = ((rang − 1) mod 9) + 1')).toBeVisible();
    await expect(page.getByText('Lettre → nombre')).toBeVisible();
    await expect(page.getByText('L : rang 12, case 3')).toBeAttached();
    await expect(page.getByText('M : rang 13, case 4')).toBeAttached();
    await expect(page.locator('svg.kamea-grid .kamea-grid__path path')).toHaveCount(1);
  });

  for (const [planet, square] of Object.entries(AGRIPPA)) {
    test(`shows Agrippa's square of ${planet}`, async ({ page }) => {
      await page.goto('./');
      await trace(page, 'Tranquillité', planet);
      const values = await page
        .locator('svg.kamea-grid .kamea-grid__numbers text')
        .evaluateAll((nodes) => nodes.map((node) => Number(node.textContent)));
      expect(values).toEqual(square.flat());
      const order = square.length;
      const magic = (order * (order * order + 1)) / 2;
      for (const row of square) {
        expect(row.reduce((sum, value) => sum + value, 0)).toBe(magic);
      }
    });
  }

  test('traces every planet with the longest intention allowed (24 letters)', async ({ page }) => {
    await page.goto('./');
    const long = 'Désinstitutionnalisation';
    expect(long.length).toBe(24);
    for (const planet of Object.keys(AGRIPPA)) {
      await trace(page, long, planet);
      await expect(sigilOf(page)).toHaveAttribute(
        'aria-label',
        new RegExp(
          `^Sigil kamea (de la|du|de) ${planet === 'Soleil' ? 'Soleil' : planet === 'Lune' ? 'Lune' : planet}$`,
        ),
      );
      const marks = await marksOf(page);
      expect(marks[0]).toBe('start-circle');
      expect(marks.at(-1)).toBe('end-bar');
    }
  });
});

test.describe('scenario 5 - nothing to trace', () => {
  for (const [text, message] of [
    ['', /Écrivez une intention avant de tracer/],
    ['   ', /Écrivez une intention avant de tracer/],
    ['123 !', /Aucune lettre latine à tracer/],
    ['日本語', /Aucune lettre latine à tracer/],
    ['A', /Une seule lettre ne trace aucun chemin/],
  ] as const) {
    test(`shows a clear message and no sigil for "${text}"`, async ({ page }) => {
      await page.goto('./');
      await trace(page, text);
      await expect(page.getByText(message)).toBeVisible();
      await expect(page.getByLabel('Intention')).toHaveAttribute('aria-invalid', 'true');
      await expect(sigilOf(page)).toHaveCount(0);
    });
  }

  test('removes a previous sigil when the next trace fails', async ({ page }) => {
    await page.goto('./');
    await trace(page, 'Calme');
    await expect(sigilOf(page)).toBeVisible();
    await trace(page, '123 !');
    await expect(sigilOf(page)).toHaveCount(0);
  });
});

test.describe('scenario 6 - one word only (D18)', () => {
  for (const [text, message] of [
    ['Je suis calme', /Un seul mot, sans espace : au-delà d’un mot, le sigil devient illisible\./],
    ['Calme serein', /Un seul mot, sans espace/],
    [
      'Anticonstitutionnellement',
      /Ce mot donne 25 lettres, 24 au plus : au-delà, le sigil devient illisible\./,
    ],
  ] as const) {
    test(`refuses "${text}" with a message under the field and draws nothing`, async ({ page }) => {
      await page.goto('./');
      await trace(page, text);
      const field = page.getByLabel('Intention');
      await expect(page.getByText(message)).toBeVisible();
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      await expect(field).toBeFocused();
      // The message is part of the field description, so it is read with the field.
      await expect(field).toHaveAccessibleDescription(message);
      await expect(sigilOf(page)).toHaveCount(0);
      await expect(page.getByText(/Rien à tracer : corrigez l’intention/)).toBeVisible();
    });
  }

  test('removes the sigil shown when a sentence is traced next', async ({ page }) => {
    await page.goto('./');
    await trace(page, 'Calme');
    await expect(sigilOf(page)).toBeVisible();
    await trace(page, 'Je suis calme');
    await expect(sigilOf(page)).toHaveCount(0);
  });

  test('says how many letters are too many while typing a long word', async ({ page }) => {
    await page.goto('./');
    await expect(
      page.getByText('Un seul mot, de 24 lettres au plus.', { exact: false }),
    ).toBeVisible();
    await page.getByLabel('Intention').fill('Anticonstitutionnellement');
    await expect(page.getByText('25 lettres : 1 de trop, 24 au plus')).toBeVisible();
  });

  for (const [text, cells] of [
    ['Aujourd’hui', 10],
    ["aujourd'hui", 10],
    ['Peut-être', 8],
    ['  Calme  ', 5],
  ] as const) {
    test(`traces "${text}" as one word of ${String(cells)} letters`, async ({ page }) => {
      await page.goto('./');
      await trace(page, text, 'Lune');
      await expect(sigilOf(page)).toBeVisible();
      await expect(page.getByLabel('Intention')).toHaveAttribute('aria-invalid', 'false');
      await expect(page.getByRole('status').filter({ hasText: /Sigil tracé/ })).toHaveText(
        `Sigil tracé : ${String(cells)} lettres sur le carré de la Lune.`,
      );
    });
  }
});

test.describe('robustness', () => {
  test('survives a double click, an Enter submit, a very long text and markup characters', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./');
    await page.getByLabel('Intention').fill('Calme');
    await page.getByRole('button', { name: 'Tracer' }).dblclick();
    await expect(sigilOf(page)).toHaveCount(1);
    await page.getByLabel('Intention').press('Enter');
    await expect(sigilOf(page)).toHaveCount(1);

    // A 12 000-letter word is refused as too long, without freezing the page.
    await trace(page, 'Paix'.repeat(3000), 'Lune');
    await expect(page.getByText(/Ce mot donne 12000 lettres, 24 au plus/)).toBeVisible();
    await expect(sigilOf(page)).toHaveCount(0);

    // Markup characters inside one word: 18 letters traced, nothing injected.
    await trace(page, '<b/onclick=alert(1)>"&\'Calme', 'Lune');
    await expect(sigilOf(page)).toBeVisible();
    // The same characters around spaces are refused as several words, still without error.
    await trace(page, '<img src=x onerror=alert(1)> "&\' Calme', 'Lune');
    await expect(page.getByText(/Un seul mot, sans espace/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('starts empty after a reload (nothing restored)', async ({ page }) => {
    await page.goto('./');
    await trace(page, 'Calme');
    await page.reload();
    await expect(sigilOf(page)).toHaveCount(0);
    await expect(page.getByLabel('Intention')).toHaveValue('');
  });
});

test.describe('privacy and CSP', () => {
  test('keeps the intention out of URL, storage, cookies, requests and attributes; no CSP violation', async ({
    page,
  }) => {
    const requests: string[] = [];
    const consoleProblems: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) consoleProblems.push(message.text());
    });
    await page.addInitScript(() => {
      const violations: string[] = [];
      Object.assign(window, { cspViolations: violations });
      document.addEventListener('securitypolicyviolation', (event) => {
        violations.push(event.effectiveDirective);
      });
    });
    await page.goto('./');
    const url = page.url();
    await trace(page, 'Calme');
    await page.getByLabel('Intention').press('Enter');
    await expect(sigilOf(page)).toBeVisible();

    expect(page.url()).toBe(url);
    const state = await page.evaluate(() => {
      const dump = (storage: Storage): string =>
        Array.from({ length: storage.length }, (_, index) => {
          const key = storage.key(index) ?? '';
          return `${key}=${storage.getItem(key) ?? ''}`;
        }).join(';');
      const attributes: string[] = [];
      document.querySelectorAll('*').forEach((element) => {
        for (const attribute of Array.from(element.attributes)) {
          if (element.tagName === 'INPUT' && attribute.name === 'value') continue;
          attributes.push(attribute.value);
        }
      });
      return {
        storage: dump(localStorage) + dump(sessionStorage) + document.cookie,
        attributes: attributes.join('|'),
        violations: (window as unknown as { cspViolations: string[] }).cspViolations,
      };
    });
    expect(state.storage.toLowerCase()).not.toMatch(/calme|suis/);
    expect(state.attributes.toLowerCase()).not.toMatch(/calme|jesuis|je suis/);
    expect(state.violations).toEqual([]);
    expect(consoleProblems).toEqual([]);
    expect((await sigilMarkup(page)).toLowerCase()).not.toMatch(/calme|jesuis/);
    expect(requests.every((request) => request.startsWith('http://localhost'))).toBe(true);
    expect(requests.join(' ').toLowerCase()).not.toMatch(/calme|suis/);
  });
});

test.describe('mobile 375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('stays usable without horizontal scroll', async ({ page }) => {
    await page.goto('./');
    await trace(page, 'Allée', 'Lune');
    await expect(sigilOf(page)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const box = await sigilOf(page).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(250);
    const target = await page.getByRole('button', { name: 'Tracer' }).boundingBox();
    expect(target?.height ?? 0).toBeGreaterThanOrEqual(40);
  });
});
