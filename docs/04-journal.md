# Journal de build — Sigil

## 2026-11-07 — T1 Socle
- Rôle : dev
- Fait : Vite 8, React 19.3, TypeScript 6.0 strict ; ESLint (strictTypeChecked, react-hooks, jsdoc), Prettier, Vitest + Testing Library, Playwright (Chromium, preview sous `/sigil/`) ; polices EB Garamond et IBM Plex Mono en woff2 local (Fontsource 5.3.0) avec OFL ; LICENSE MIT, `.gitattributes` en LF.
- Vérifications : `lint`, `typecheck`, `test` (2/2), `build`, `test:e2e` (1/1, police chargée en local) → verts, revérifiés au contrôle sauf e2e.
- Écarts au plan : polices dans `src/assets/fonts/` (versionnées par Vite) ; ajout de `base.css`, `App.css`, `src/test/setup.ts` ; TypeScript 6.0 (typescript-eslint ne prend pas encore 7), jsdom 29 et eslint-plugin-jsdoc 63 (Node 24.14 sur la machine).
- Points ouverts : 10 vulnérabilités moyennes `minimatch` dans l'outillage ESLint uniquement (rien dans le build) ; Node ≥ 24.15 permettrait de monter jsdom et jsdoc.
