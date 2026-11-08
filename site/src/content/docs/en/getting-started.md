---
title: Getting started
description: Run Sigil locally, run the checks and tests, build the site, and build this documentation.
---

## Requirements

- Node.js 22.13 or later in the 22 line, or 24 and later
- npm

No environment variable is needed: the app has no server, no key and no account.

## Install and run

From the project root:

```sh
npm ci             # installs the exact versions of package-lock.json
npm run dev        # development server, http://localhost:5173/sigil/
```

The development server removes the Content Security Policy `<meta>` of `index.html`,
because its hot reload relies on inline scripts and styles. The production build keeps it;
check CSP-related changes with `npm run preview` or the end-to-end tests.

## Check and test

```sh
npm run lint          # ESLint: type-aware rules and TSDoc checks
npm run format:check  # Prettier, without writing (npm run format rewrites the files)
npm run typecheck     # TypeScript, strict mode
npm run test          # unit tests (Vitest + Testing Library, jsdom)
npm run test:scripts  # tests of the scripts in scripts/ (Node test runner)
```

End-to-end tests run with Playwright against the production build, served by
`vite preview` under `/sigil/` (Chromium only):

```sh
npx playwright install chromium   # once, before the first run
npm run test:e2e
```

Playwright builds the site and starts the preview server itself, on port 4173. Locally, it
reuses a server already running on that port.

## Generated files

Some committed files come from scripts: the Spare glyphs (`npm run glyphs:generate`) and
the README images (`npm run readme:assets`). See
[Operations](/sigil/docs/en/operations/#generated-files) for when and how to run them.

## Build

```sh
npm run build      # type-check, then the static site in dist/, served under /sigil/
npm run preview    # serves dist/ at http://localhost:4173/sigil/
```

The build also publishes `LICENSE.txt`, `NOTICE.txt`, the font licences and
`THIRD-PARTY-LICENSES.txt` at the root of the site, and generates the service worker that
makes the app work offline.

## Build this documentation

The documentation is a separate Starlight site in `site/`, with its own dependencies:

```sh
cd site
npm ci
npm run build      # generates the API reference, builds dist/, checks every internal link
npm run preview    # serves site/dist/ at http://localhost:4321/sigil/docs/
```

The deploy workflow builds it the same way and publishes it under `/sigil/docs/`.

The API reference (`site/src/content/docs/en/reference/`) is generated at each build from
the TSDoc of the app’s public modules, so the app’s dependencies must be installed first
(`npm ci` at the root). See [Contributing](/sigil/docs/en/contributing/) for how to write
the documentation.

## Next

- [Architecture](/sigil/docs/en/architecture/): how the code is organised.
- [Operations](/sigil/docs/en/operations/): deploy, regenerate the glyphs, change safely.
