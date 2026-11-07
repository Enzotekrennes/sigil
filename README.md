# Sigil

Deterministic sigil generator: turns an intention into a sigil with the kamea
(planetary magic squares) or Austin Osman Spare's method, drawn in SVG. Everything
runs in the browser; the intention never leaves it.

## Requirements

- Node.js 22.13+ or 24+
- npm

## Run

```sh
npm install
npm run dev        # development server, http://localhost:5173/sigil/
```

## Test

```sh
npm run lint       # ESLint (type-aware rules, TSDoc checks)
npm run typecheck  # TypeScript, strict mode
npm run test       # unit tests (Vitest + Testing Library)
npx playwright install chromium   # once, before the first end-to-end run
npm run test:e2e   # end-to-end tests (Playwright) against the production build
npm run format     # Prettier
```

## Build

```sh
npm run build      # static site in dist/, served under /sigil/
npm run preview    # serves dist/ at http://localhost:4173/sigil/
```

No environment variable is needed.

## Deploy

The site is published to GitHub Pages at `https://<account>.github.io/sigil/` by the
workflow `.github/workflows/deploy.yml`, on every push to `main` or by hand
(Actions → Deploy to GitHub Pages → Run workflow). It runs `npm ci`, lint, type-check,
unit tests and the build, then publishes `dist/`.

One-time setup on GitHub: Settings → Pages → Build and deployment → Source:
**GitHub Actions**. If the repository is not named `sigil`, change `BASE_PATH` in
`vite.config.ts` (and the base URL in `playwright.config.ts`).

The build is an installable PWA: a service worker precaches every file, so the app
works offline after the first visit, and a new deploy is picked up on the next visit.
GitHub Pages cannot send custom headers, so the Content Security Policy and the
referrer policy are `<meta>` elements in `index.html`. The dev server removes the CSP
`<meta>` (its hot reload relies on inline scripts and styles); `npm run preview` and
the end-to-end tests run with it.

PWA icons live in `public/`: `icon.svg` (also the favicon) and `icon-maskable.svg` are
the sources of the PNG files next to them, exported at 180, 192 and 512 px.

## Licence

Code under the [MIT licence](LICENSE). Fonts: EB Garamond and IBM Plex Mono, SIL Open
Font License 1.1 (`src/assets/fonts/*/OFL.txt`).
