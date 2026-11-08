---
title: Architecture
description: How a typed word becomes a sigil, how the code is split into features, the shared sigil model, and the main design decisions.
---

Sigil is a single-page app with no server: React 19, TypeScript in strict mode and Vite,
rendered in SVG. Every computation runs in the browser.

## Data flow

```
typed text
  → intention: normalizeIntention (letters A–Z, ignored characters)
               checkSingleWord (one word, 24 letters at most)
  → method
      kamea: letters → numbers → cells of the square → one polyline + marks
      spare: reduction → angular skeletons → candidate bind runes (seeded)
             → lowest penalty → shared strokes merged
  → Sigil (strokes, marks, explanation steps, seed) in a 0–100 frame
  → SigilRenderer (animated SVG, style)   + explanation panel (steps)
  → export: SVG (serialised) / PNG (canvas) / PDF (pdf-lib, size in cm)
```

`src/app/trace.ts` chains these steps behind the **Trace** button and turns their errors
into the message shown under the field. Nothing leaves the browser; only the language and
the theme go to `localStorage`.

## Modules

```
src/
  app/                  the screen: App.tsx, trace chain, dictionaries, theme
  features/intention/   normalisation, single-word rule, Spare reduction
  features/kamea/       Agrippa's squares, conversion, path and marks
  features/spare/       Hershey glyphs, angular skeletons, bind rune, score, merging
  features/sigil/       shared model, SigilRenderer, animation, style, stencil scale
  features/explain/     the "How it's made" panels (kamea and Spare)
  features/export/      export dialog, SVG, PNG, real-size stencil PDF
  features/i18n/        languages, detection, persistence, number formatting
  components/ui/        generic components (Button, Dialog, Slider, Switch…), no text of their own
  lib/random.ts         cyrb53 hash and mulberry32 generator
  styles/               design tokens, local fonts, base styles
```

Rules that keep the modules apart:

- each feature exposes its public API in `index.ts`; other features import from that file
  only. The shared model types (`features/sigil/types.ts`) and frame constants
  (`features/sigil/frame.ts`) are imported directly, so a method does not load the
  renderer;
- the methods (`kamea`, `spare`) are pure and deterministic: no I/O, no randomness outside
  the seeded generator;
- the interface texts live in two typed dictionaries, `src/app/strings.en.ts` and
  `src/app/strings.fr.ts`; the compiler rejects a key missing from one of them. Features
  receive their texts from the app and hold no wording of their own.

The [API reference](/sigil/docs/en/reference/) documents each public module.

## The sigil model

Every method produces the same `Sigil` (`src/features/sigil/types.ts`):

| Field | Content |
|---|---|
| `strokes` | Polylines in a square frame normalised to 0–100, y downwards |
| `marks` | Kamea marks: `start-circle`, `end-bar`, `loop` (empty for Spare) |
| `viewBox` | The 0–100 frame |
| `steps` | Explanation steps, a union discriminated by `kind` (`kamea-…`, `spare-…`) |
| `seed` | Seed of the Spare composition; a constant for kamea, which draws nothing at random |

The `Sigil` carries no colour or stroke width. Those come from `StyleOptions` (stroke
width, rounded ends, framing circle, render mode `screen` or `stencil`), applied by the
renderer and the exports.

## Main decisions

The full list, with the options rejected, is in `docs/03-plan.md` (decisions D1 to D21).

| Decision | Choice | Why |
|---|---|---|
| App shape | Single-page app with Vite, no Next.js | No server and no routes: a static site is enough |
| Privacy | No network call, intention never in the URL, storage or file names; CSP in a `<meta>` | GitHub Pages cannot send custom headers |
| Strict CSP | `style-src 'self'` without `'unsafe-inline'`: dynamic styles go through React's `style` prop only; the theme start-up script is a file, not inline | Keeps the production policy strict; checked by end-to-end tests |
| Kamea conversion | `((rank − 1) mod N²) + 1`, A = 1 … Z = 26, for the seven squares | One rule, shown in the panel |
| Kamea letters | Every letter kept; a loop when two consecutive numbers are equal | The path follows the word as typed |
| Spare reduction | Duplicates always removed, vowels by default, Y kept | Spare's method, with an option for words with few consonants |
| One word | The intention is one word of at most 24 letters | Beyond one word, the sigil becomes unreadable |
| Bind rune | Spare composes a bind rune on a vertical stem, letters redrawn with straight segments | Replaces a free superimposition judged scribbled |
| Rune score | Penalty: hatches first, then ink, silhouette, symmetry, balance, crossings, crowding, small letters | Clean runes for two to four kept letters |
| Determinism | Seed = hash of method, kept letters, vowel option and variant; home-made `cyrb53` + `mulberry32` | Same settings, same sigil, testable without a dependency |
| Letter skeletons | Hershey Roman Simplex, converted once into a TypeScript module | Quality single strokes, free to use with attribution |
| PNG | Rasterised from the SVG through a canvas, at export only | The screen stays 100 % SVG |
| PDF | Always a stencil; size = largest dimension of the ink; 1–25 cm, 8 cm by default; `pdf-lib` loaded on demand | What a tattoo artist measures with a ruler |
| Offline | `vite-plugin-pwa` (Workbox) precaches the whole build | Installable PWA without a hand-written service worker |
| i18n | Home-made typed dictionary | Two languages, a few dozen strings |
| Theme | System / Ink on paper / Gold on black; stored only when chosen | Lets the user go back to the system setting |
