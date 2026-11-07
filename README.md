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

## Licence

Code under the [MIT licence](LICENSE). Fonts: EB Garamond and IBM Plex Mono, SIL Open
Font License 1.1 (`src/assets/fonts/*/OFL.txt`).
