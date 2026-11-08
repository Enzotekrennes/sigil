---
title: Operations
description: Deploy to GitHub Pages, regenerate the Hershey glyphs, keep dependencies up to date, and change the app without breaking it.
---

Sigil has no server, no database and no account: there is nothing to monitor at run time.
Operations come down to the deployment, the dependencies and a few files that must change
together.

## Deploy

The workflow `.github/workflows/deploy.yml` publishes the app to GitHub Pages at
`https://<account>.github.io/sigil/`:

- on every push to `main`;
- by hand: **Actions → Deploy to GitHub Pages → Run workflow**.

The `build` job runs the same checks as a local session: `npm ci --ignore-scripts`, lint,
formatting, type-check, unit tests, script tests, the build, then the privacy, CSP and
offline end-to-end specs on that build. The `deploy` job publishes only an artifact that
passed them. One deploy runs at a time; a newer push does not cancel a deploy in progress.

This documentation site (`site/`) is built separately; the workflow does not publish it
yet. Its planned address is `https://<account>.github.io/sigil/docs/`.

One-time setup on GitHub: **Settings → Pages → Build and deployment → Source: GitHub
Actions**.

### If a deploy fails

1. Open the failed run in the **Actions** tab and find the first red step.
2. Run the same command locally (see [Getting started](/sigil/docs/en/getting-started/)):
   `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`,
   `npm run test:scripts`, `npm run build`, or the end-to-end specs.
3. Fix, push again. The site in production stays on the last good deploy meanwhile.

### After a deploy

Visitors get the new version on their next visit: the service worker replaces the stored
files without a prompt.

## Regenerate the Hershey glyphs

`src/features/spare/glyphs/hersheyRomanSimplex.ts` is generated from the Hershey Roman
Simplex font file `rowmans.jhf`, which is not versioned. To regenerate it:

1. Download
   [`rowmans.jhf`](https://raw.githubusercontent.com/kamalmostafa/hershey-fonts/master/hershey-fonts/rowmans.jhf)
   into a folder **outside** the repository.
2. Run:

   ```sh
   npm run glyphs:generate -- <path to rowmans.jhf>
   ```

The script first checks the file’s SHA-256 against the one the glyphs were generated from,
and stops without writing anything if it differs. The output is deterministic: running it
twice gives the same file, and a unit test checks that the committed module matches its
source records. Without a path, the script prints its usage and stops.

## Dependencies

Dependabot (`.github/dependabot.yml`) proposes each week one grouped pull request for the
npm dependencies and one for the GitHub Actions, which are pinned to full commit SHAs.
Review them like any change: the workflow runs every check before a deploy.

The documentation site in `site/` has its own `package.json` and lockfile, outside
Dependabot’s current configuration.

## Change without breaking

| If you change… | Also change… |
|---|---|
| The repository name (the `/sigil/` path) | `BASE_PATH` in `vite.config.ts`, the base URL in `playwright.config.ts`, and `BASE_PATH` and the app links in `site/astro.config.mjs` |
| A theme background (`--color-bg` in `src/styles/tokens.css`) | Its copies: the second “gold on black” block of `tokens.css`, the `theme-color` metadata of `index.html`, `THEME_BACKGROUNDS` in `src/app/theme.ts` and `PAPER_COLOR` in `vite.config.ts`; `e2e/theme.spec.ts` catches a drift |
| The Content Security Policy in `index.html` | Keep its comment: the dev server finds the `<meta>` by it, and fails loudly otherwise |
| An interface text | Both dictionaries, `strings.fr.ts` and `strings.en.ts` |
| A behaviour of a public function | Its TSDoc in the same commit: the API reference is generated from it |
| The Hershey data or the fonts | `NOTICE` and `LICENSE`, which travel with the site |

Never put the intention in the URL, in storage, in an attribute or in a file name, and
never add a request to another site: the end-to-end privacy specs (`e2e/f7-acceptance.spec.ts`,
`e2e/privacy.spec.ts`) check it before every deploy.
