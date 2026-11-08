---
title: Credits and licences
description: Licence of Sigil, the Hershey Fonts data and its required acknowledgements, the fonts, and the bundled dependencies.
---

## Sigil

Sigil is written by Enzo Monnier and published under the **MIT licence**. The licence does not
cover the font files, the Hershey Fonts glyph data, or the third-party packages bundled into
the site, which keep their own terms (below).

The built app publishes these texts at its root, available offline like the rest of the
app:

- [`LICENSE.txt`](/sigil/LICENSE.txt): the MIT licence and its exceptions;
- [`NOTICE.txt`](/sigil/NOTICE.txt): the third-party notices, Hershey acknowledgements
  included;
- [`THIRD-PARTY-LICENSES.txt`](/sigil/THIRD-PARTY-LICENSES.txt): the licences of the bundled
  packages;
- [`OFL-EB-Garamond.txt`](/sigil/OFL-EB-Garamond.txt) and
  [`OFL-IBM-Plex-Mono.txt`](/sigil/OFL-IBM-Plex-Mono.txt): the font licences.

## Hershey Fonts

The letter skeletons of Spare’s method are the capitals A to Z of the **Hershey Roman
Simplex** font (records 501 to 526 of `rowmans.jhf`, from the first Usenet distribution of
the Hershey Fonts, 1986). They were converted into TypeScript polylines by
`scripts/generate-hershey-glyphs.js`; no glyph shape was altered. Sigil then redraws their
curves as straight segments at run time.

The distribution may be used by anyone for any purpose, provided its acknowledgements travel
with the data. As required:

- The Hershey Fonts were originally created by Dr. A. V. Hershey while working at the
  U. S. National Bureau of Standards.
- The format of the Font data in this distribution was originally created by James Hurt,
  Cognition, Inc., 900 Technology Park Drive, Billerica, MA 01821
  (mit-eddie!ci-dandelion!hurt).

The data may be converted into any format except the one distributed by the U.S. NTIS; the
converted data is not in that format. The full notice is in `NOTICE`, and the
acknowledgements are also kept as a legal comment in the built JavaScript, next to the
glyph data.

## Fonts

The app serves its two font families itself, under the **SIL Open Font License 1.1**:

| Family | Use | Copyright |
|---|---|---|
| EB Garamond | Titles, the intention, texts of the panel | 2017 The EB Garamond Project Authors |
| IBM Plex Mono | Labels, buttons, numbers, letters | 2017 IBM Corp. |

The licence texts sit next to the font files in the repository
(`src/assets/fonts/*/OFL.txt`).

## Dependencies

Bundled into the app: React and React DOM, `pdf-lib` (loaded only for the first PDF
export), their own dependencies, and the Workbox runtime of the service worker. Their
licences are collected by the build into `THIRD-PARTY-LICENSES.txt`.

Used to build and test the app, not shipped: Vite, TypeScript, ESLint, Prettier, Vitest,
Testing Library, Playwright and `vite-plugin-pwa`.

This documentation is built with Astro and Starlight, and its API reference with TypeDoc,
`typedoc-plugin-markdown` and `starlight-typedoc`.

## Sources of the methods

- The planetary squares: Heinrich Cornelius Agrippa, *De occulta philosophia libri tres*
  (Cologne, 1533), book II, chapter 22.
- The reduction and fusion of letters: the sigil method of Austin Osman Spare.
