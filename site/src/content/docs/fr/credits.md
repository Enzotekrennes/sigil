---
title: Crédits et licences
description: Licence de Sigil, les données Hershey Fonts et leurs mentions obligatoires, les polices, et les dépendances embarquées.
---

## Sigil

Sigil est écrit par Enzo Abel et publié sous **licence MIT**. Cette licence ne couvre ni les
fichiers de polices, ni les données de glyphes Hershey Fonts, ni les paquets tiers embarqués
dans le site, qui gardent leurs propres conditions (ci-dessous).

L'app construite publie ces textes à sa racine, disponibles hors ligne comme le reste de
l'app :

- [`LICENSE.txt`](/sigil/LICENSE.txt) : la licence MIT et ses exceptions ;
- [`NOTICE.txt`](/sigil/NOTICE.txt) : les mentions des tiers, dont les remerciements
  Hershey ;
- [`THIRD-PARTY-LICENSES.txt`](/sigil/THIRD-PARTY-LICENSES.txt) : les licences des paquets
  embarqués ;
- [`OFL-EB-Garamond.txt`](/sigil/OFL-EB-Garamond.txt) et
  [`OFL-IBM-Plex-Mono.txt`](/sigil/OFL-IBM-Plex-Mono.txt) : les licences des polices.

## Hershey Fonts

Les squelettes des lettres de la méthode de Spare sont les capitales A à Z de la police
**Hershey Roman Simplex** (enregistrements 501 à 526 de `rowmans.jhf`, issus de la première
distribution Usenet des Hershey Fonts, 1986). Ils ont été convertis en polylignes TypeScript
par `scripts/generate-hershey-glyphs.js` ; aucune forme de glyphe n'a été modifiée. Sigil
redessine ensuite leurs courbes en segments droits à l'exécution.

La distribution peut être utilisée par tous et pour tout usage, à condition que ses
remerciements accompagnent les données. Comme exigé (texte d'origine, en anglais) :

- The Hershey Fonts were originally created by Dr. A. V. Hershey while working at the
  U. S. National Bureau of Standards.
- The format of the Font data in this distribution was originally created by James Hurt,
  Cognition, Inc., 900 Technology Park Drive, Billerica, MA 01821
  (mit-eddie!ci-dandelion!hurt).

Les données peuvent être converties dans tout format, sauf celui distribué par le NTIS
américain ; les données converties ne sont pas dans ce format. L'avis complet se trouve
dans `NOTICE`, et les remerciements sont aussi conservés en commentaire légal dans le
JavaScript construit, à côté des données de glyphes.

## Polices

L'app sert elle-même ses deux familles de polices, sous **SIL Open Font License 1.1** :

| Famille | Usage | Copyright |
|---|---|---|
| EB Garamond | Titres, intention, textes du panneau | 2017 The EB Garamond Project Authors |
| IBM Plex Mono | Libellés, boutons, nombres, lettres | 2017 IBM Corp. |

Les textes de licence se trouvent à côté des fichiers de polices dans le dépôt
(`src/assets/fonts/*/OFL.txt`).

## Dépendances

Embarqués dans l'app : React et React DOM, `pdf-lib` (chargé seulement au premier export
PDF), leurs propres dépendances, et le moteur Workbox du service worker. Leurs licences sont
rassemblées par le build dans `THIRD-PARTY-LICENSES.txt`.

Utilisés pour construire et tester l'app, non livrés : Vite, TypeScript, ESLint, Prettier,
Vitest, Testing Library, Playwright et `vite-plugin-pwa`.

Cette documentation est construite avec Astro et Starlight, et sa référence d'API avec
TypeDoc, `typedoc-plugin-markdown` et `starlight-typedoc`.

## Sources des méthodes

- Les carrés planétaires : Heinrich Cornelius Agrippa, *De occulta philosophia libri tres*
  (Cologne, 1533), livre II, chapitre 22.
- La réduction et la fusion des lettres : la méthode des sigils d'Austin Osman Spare.
