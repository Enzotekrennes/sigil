---
title: Prise en main
description: Lancer Sigil en local, lancer les vérifications et les tests, construire le site, et construire cette documentation.
---

## Prérequis

- Node.js 22.13 ou plus dans la branche 22, ou 24 et plus
- npm

Aucune variable d'environnement n'est nécessaire : l'app n'a ni serveur, ni clé, ni compte.

## Installer et lancer

Depuis la racine du projet :

```sh
npm ci             # installs the exact versions of package-lock.json
npm run dev        # development server, http://localhost:5173/sigil/
```

Le serveur de développement retire la balise `<meta>` de la politique de sécurité du
contenu (CSP) de `index.html`, car son rechargement à chaud repose sur des scripts et des
styles en ligne. Le build de production la garde ; vérifiez toute modification liée à la
CSP avec `npm run preview` ou les tests de bout en bout.

## Vérifier et tester

```sh
npm run lint          # ESLint: type-aware rules and TSDoc checks
npm run format:check  # Prettier, without writing (npm run format rewrites the files)
npm run typecheck     # TypeScript, strict mode
npm run test          # unit tests (Vitest + Testing Library, jsdom)
npm run test:scripts  # tests of the scripts in scripts/ (Node test runner)
```

Les tests de bout en bout tournent avec Playwright sur le build de production, servi par
`vite preview` sous `/sigil/` (Chromium seulement) :

```sh
npx playwright install chromium   # once, before the first run
npm run test:e2e
```

Playwright construit le site et lance lui-même le serveur de prévisualisation, sur le
port 4173. En local, il réutilise un serveur qui tourne déjà sur ce port.

## Fichiers générés

Certains fichiers versionnés viennent de scripts : les glyphes de Spare
(`npm run glyphs:generate`) et les images du README (`npm run readme:assets`). Voir
[Exploitation](/sigil/docs/fr/operations/#fichiers-générés) pour savoir quand et comment
les lancer.

## Construire

```sh
npm run build      # type-check, then the static site in dist/, served under /sigil/
npm run preview    # serves dist/ at http://localhost:4173/sigil/
```

Le build publie aussi `LICENSE.txt`, `NOTICE.txt`, les licences des polices et
`THIRD-PARTY-LICENSES.txt` à la racine du site, et génère le service worker qui fait
fonctionner l'app hors ligne.

## Construire cette documentation

La documentation est un site Starlight à part, dans `site/`, avec ses propres
dépendances :

```sh
cd site
npm ci
npm run build      # generates the API reference, builds dist/, checks every internal link
npm run preview    # serves site/dist/ at http://localhost:4321/sigil/docs/
```

Le workflow de déploiement la construit de la même façon et la publie sous `/sigil/docs/`.

La référence d'API (`site/src/content/docs/en/reference/`) est générée à chaque build à
partir du TSDoc des modules publics de l'app : les dépendances de l'app doivent donc être
installées d'abord (`npm ci` à la racine). Voir [Contribuer](/sigil/docs/fr/contributing/)
pour la façon d'écrire la documentation.

## Ensuite

- [Architecture](/sigil/docs/fr/architecture/) : comment le code est organisé.
- [Exploitation](/sigil/docs/fr/operations/) : déployer, régénérer les glyphes, modifier
  sans casser.
