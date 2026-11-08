---
title: Contributing
description: How to propose a change to Sigil, the checks it must pass, how to document code, and how to update this documentation.
---

## Before you start

- Read [Architecture](/sigil/docs/en/architecture/): each feature has its folder under
  `src/features/` and a public API in its `index.ts`.
- Decisions and their reasons are recorded in `docs/03-plan.md` (in French). A change that
  goes against one of them starts with a discussion, not a pull request.

## Make a change

1. Work on a branch, not on `main`: every push to `main` is deployed.
2. Keep each commit small and named in the conventional style, with the task or feature in
   scope when there is one, for example `feat(T24): …`, `fix(T23): …`, `test(F2): …`,
   `docs: …`.
3. Give every business rule a unit test, and every bug fixed a test that fails without the
   fix.
4. Run every check before pushing:

```sh
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run test:scripts
npm run test:e2e
```

The deploy workflow runs the same checks, except for the end-to-end specs, of which it
plays only the privacy, CSP and offline ones.

## Write code that documents itself

Code, comments and technical messages are in English; the interface texts are in the two
dictionaries, `src/app/strings.fr.ts` and `src/app/strings.en.ts`.

ESLint enforces TSDoc (`eslint-plugin-jsdoc`):

- every file starts with a header: what it is responsible for, what it exposes, and what it
  does not do when that could be confused;
- every function, method, class and exported arrow function has a comment: what it does,
  its parameters (`@param name - description`, with their unit, format or range), what it
  returns, the errors it throws and its side effects;
- types are not repeated in comments: TypeScript declares them.

This documentation is the API reference: write it for a reader who does not have the code
open. If a behaviour changes, its comment changes in the same commit.

## Update this documentation

The documentation lives in `site/` (Starlight). Pages are in
`site/src/content/docs/en/` and `site/src/content/docs/fr/`, with the same file names.

1. Write or change the English page first, then the French one, with the same sections in
   the same order.
2. Use the terms of the glossary, `site/glossary.md`, and add any new term to it.
3. Write internal links with the full base path, for example
   `/sigil/docs/en/guide/export/`: the build fails on a broken or relative link.
4. Never edit `site/src/content/docs/en/reference/`: it is generated from the code’s TSDoc
   at each build. If the reference is wrong, fix the comment in the code.
5. Check the build:

```sh
cd site
npm run build
```

Screenshots go to `site/src/assets/screenshots/`. Take them from a local build of the app
with a neutral example word (such as “Calme”), never with a real intention.
