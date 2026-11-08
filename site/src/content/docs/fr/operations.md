---
title: Exploitation
description: Déployer sur GitHub Pages, régénérer les glyphes Hershey, tenir les dépendances à jour, et modifier l'app sans la casser.
---

Sigil n'a ni serveur, ni base de données, ni compte : il n'y a rien à surveiller pendant
qu'il tourne. L'exploitation se résume au déploiement, aux dépendances et à quelques
fichiers qui doivent changer ensemble.

## Déployer

Le workflow `.github/workflows/deploy.yml` publie l'app sur GitHub Pages à l'adresse
`https://<account>.github.io/sigil/`, et cette documentation à côté, à l'adresse
`https://<account>.github.io/sigil/docs/` :

- à chaque push sur `main` ;
- à la main : **Actions → Deploy to GitHub Pages → Run workflow**.

Le job `build` lance les mêmes vérifications qu'une session locale :
`npm ci --ignore-scripts`, lint, formatage, types, tests unitaires, tests des scripts et
build de l'app. Il installe et construit ensuite la documentation (`site/`), qui échoue sur
un lien interne cassé, et joue les tests de bout en bout de confidentialité, de CSP et de
hors ligne sur le build de l'app. Enfin, il copie la documentation dans `dist/docs/`. Le
job `deploy` ne publie qu'un build qui a passé chaque étape. Un seul déploiement à la
fois ; un push plus récent n'annule pas un déploiement en cours.

Le service worker de l'app laisse `/sigil/docs/` au réseau (`navigateFallbackDenylist`
dans `vite.config.ts`) : sans cela, chaque page de documentation ouvrirait l'app. La
documentation n'est donc pas disponible hors ligne.

Réglage à faire une fois sur GitHub : **Settings → Pages → Build and deployment → Source:
GitHub Actions**.

### Si un déploiement échoue

1. Ouvrez l'exécution en échec dans l'onglet **Actions** et repérez la première étape en
   rouge.
2. Lancez la même commande en local (voir [Prise en main](/sigil/docs/fr/getting-started/)) :
   `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`,
   `npm run test:scripts`, `npm run build`, les tests de bout en bout, ou `npm run build`
   dans `site/` pour la documentation.
3. Corrigez, poussez de nouveau. Pendant ce temps, le site en ligne reste sur le dernier
   déploiement réussi.

### Après un déploiement

Les visiteurs reçoivent la nouvelle version à leur visite suivante : le service worker
remplace les fichiers enregistrés, sans rien demander.

## Fichiers générés

Trois sortes de fichiers versionnés sont produits par des scripts ; ne les modifiez jamais
à la main.

### Glyphes Hershey

`src/features/spare/glyphs/hersheyRomanSimplex.ts` est généré à partir du fichier de la
police Hershey Roman Simplex `rowmans.jhf`, qui n'est pas versionné. Pour le régénérer :

1. Téléchargez
   [`rowmans.jhf`](https://raw.githubusercontent.com/kamalmostafa/hershey-fonts/master/hershey-fonts/rowmans.jhf)
   dans un dossier **hors** du dépôt.
2. Lancez :

   ```sh
   npm run glyphs:generate -- <path to rowmans.jhf>
   ```

Le script vérifie d'abord l'empreinte SHA-256 du fichier par rapport à celle d'origine des
glyphes, et s'arrête sans rien écrire si elle diffère. Le résultat est déterministe : deux
lancements donnent le même fichier, et un test unitaire vérifie que le module versionné
correspond à ses enregistrements source. Sans chemin, le script affiche son usage et
s'arrête.

### Images du README

Les images du README, `.github/readme/trace-spare.svg`, `trace-kamea.svg` et
`examples.svg`, sont dessinées à partir du tracé et de la géométrie de l'app elle-même :

```sh
npm run readme:assets
```

Le résultat est déterministe : relancé sur un code inchangé, il réécrit les mêmes octets.
Lancez-le après une modification d'une méthode ou du moteur de rendu, pour que le README
montre ce que l'app dessine. Les deux sigils tracés sont des SVG animés ; les lecteurs qui
n'animent pas les SVG, et ceux qui demandent de réduire les animations, voient le sigil
complet.

### Icônes de la PWA

`public/icon.svg` (aussi l'icône du site) et `public/icon-maskable.svg` sont les sources
des icônes PNG voisines, exportées en 180, 192 et 512 px.

## Dépendances

Dependabot (`.github/dependabot.yml`) propose chaque semaine une pull request groupée par
écosystème et par dossier : les dépendances npm de l'app, celles de la documentation
(`site/`, avec son propre `package.json` et son propre lockfile), et les GitHub Actions,
figées par leur SHA de commit complet. Relisez-les comme toute modification : le workflow
lance toutes les vérifications, build de la documentation compris, avant un déploiement.

## Modifier sans casser

| Si vous changez… | Changez aussi… |
|---|---|
| Le nom du dépôt (le chemin `/sigil/`) | `BASE_PATH` et `DOCS_NAVIGATION_PATTERN` dans `vite.config.ts`, l'URL de base dans `playwright.config.ts`, et `BASE_PATH` et les liens vers l'app dans `site/astro.config.mjs` |
| Un fond de thème (`--color-bg` dans `src/styles/tokens.css`) | Ses copies : le second bloc « or sur noir » de `tokens.css`, les métadonnées `theme-color` de `index.html`, `THEME_BACKGROUNDS` dans `src/app/theme.ts` et `PAPER_COLOR` dans `vite.config.ts` ; `e2e/theme.spec.ts` détecte un écart |
| La politique de sécurité du contenu dans `index.html` | Gardez son commentaire : le serveur de développement trouve la balise `<meta>` grâce à lui, et échoue bruyamment sinon |
| Un texte de l'interface | Les deux dictionnaires, `strings.fr.ts` et `strings.en.ts` |
| Le comportement d'une fonction publique | Son TSDoc dans le même commit : la référence d'API en est générée |
| Une méthode ou le moteur de rendu | Les images du README : `npm run readme:assets` |
| Les données Hershey ou les polices | `NOTICE` et `LICENSE`, qui accompagnent le site |

Ne mettez jamais l'intention dans l'URL, le stockage, un attribut ou un nom de fichier, et
n'ajoutez jamais de requête vers un autre site : les tests de bout en bout de
confidentialité (`e2e/f7-acceptance.spec.ts`, `e2e/privacy.spec.ts`) le vérifient avant
chaque déploiement.
