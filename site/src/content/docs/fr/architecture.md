---
title: Architecture
description: Comment un mot tapé devient un sigil, comment le code se répartit en fonctionnalités, le modèle commun du sigil, et les principales décisions.
---

Sigil est une app d'une seule page sans serveur : React 19, TypeScript en mode strict et
Vite, avec un rendu SVG. Tous les calculs se font dans le navigateur.

## Flux des données

```
typed text
  → intention: normalizeIntention (letters A–Z, ignored characters)
               checkSingleWord (one word, 24 letters at most)
  → method
      kamea: letters → numbers → cells of the square → one polyline + marks
      spare: reduction → angular skeletons → candidate bind runes (seeded)
             → lowest penalty → shared strokes merged
  → Sigil (strokes, marks, explanation steps, seed) in a 0–100 frame
  → SigilRenderer (animated SVG, style)   + explanation panel (steps)
  → export: SVG (serialised) / PNG (canvas) / PDF (pdf-lib, size in cm)
```

`src/app/trace.ts` enchaîne ces étapes derrière le bouton **Tracer** et transforme leurs
erreurs en message affiché sous le champ. Rien ne quitte le navigateur ; seuls la langue et
le thème vont dans `localStorage`.

## Modules

```
src/
  app/                  the screen: App.tsx, trace chain, dictionaries, theme
  features/intention/   normalisation, single-word rule, Spare reduction
  features/kamea/       Agrippa's squares, conversion, path and marks
  features/spare/       Hershey glyphs, angular skeletons, bind rune, score, merging
  features/sigil/       shared model, SigilRenderer, animation, style, stencil scale
  features/explain/     the "How it's made" panels (kamea and Spare)
  features/export/      export dialog, SVG, PNG, real-size stencil PDF
  features/i18n/        languages, detection, persistence, number formatting
  components/ui/        generic components (Button, Dialog, Slider, Switch…), no text of their own
  lib/random.ts         cyrb53 hash and mulberry32 generator
  styles/               design tokens, local fonts, base styles
```

Règles qui séparent les modules :

- chaque fonctionnalité expose son API publique dans son `index.ts` ; les autres
  fonctionnalités n'importent que ce fichier. Les types du modèle commun
  (`features/sigil/types.ts`) et les constantes du cadre (`features/sigil/frame.ts`)
  s'importent directement, pour qu'une méthode ne charge pas le moteur de rendu ;
- les méthodes (`kamea`, `spare`) sont pures et déterministes : aucune entrée-sortie, aucun
  hasard hors du générateur à graine ;
- les textes de l'interface vivent dans deux dictionnaires typés, `src/app/strings.en.ts`
  et `src/app/strings.fr.ts` ; le compilateur refuse une clé absente de l'un d'eux. Les
  fonctionnalités reçoivent leurs textes de l'app et n'ont aucune formulation à elles.

La [référence d'API](/sigil/docs/en/reference/) documente chaque module public (en
anglais).

## Le modèle du sigil

Chaque méthode produit le même `Sigil` (`src/features/sigil/types.ts`) :

| Champ | Contenu |
|---|---|
| `strokes` | Polylignes dans un cadre carré normalisé de 0 à 100, y vers le bas |
| `marks` | Marques kamea : `start-circle`, `end-bar`, `loop` (vide pour Spare) |
| `viewBox` | Le cadre 0–100 |
| `steps` | Étapes explicatives, une union discriminée par `kind` (`kamea-…`, `spare-…`) |
| `seed` | Graine de la composition de Spare ; une constante pour le kamea, qui ne tire rien au hasard |

Le `Sigil` ne porte ni couleur ni épaisseur de trait. Elles viennent de `StyleOptions`
(épaisseur, extrémités arrondies, cercle d'encadrement, mode de rendu `screen` ou
`stencil`), appliqué par le moteur de rendu et les exports.

## Principales décisions

La liste complète, avec les options écartées, se trouve dans `docs/03-plan.md` (décisions
D1 à D21).

| Décision | Choix | Pourquoi |
|---|---|---|
| Forme de l'app | App d'une seule page avec Vite, sans Next.js | Ni serveur ni routes : un site statique suffit |
| Confidentialité | Aucun appel réseau, intention jamais dans l'URL, le stockage ou les noms de fichiers ; CSP en balise `<meta>` | GitHub Pages ne permet pas d'en-têtes personnalisés |
| CSP stricte | `style-src 'self'` sans `'unsafe-inline'` : les styles dynamiques passent seulement par la prop `style` de React ; le script de démarrage du thème est un fichier, pas du code en ligne | Garde la politique de production stricte ; vérifié par les tests de bout en bout |
| Conversion kamea | `((rang − 1) mod N²) + 1`, A = 1 … Z = 26, pour les sept carrés | Une seule règle, affichée dans le panneau |
| Lettres kamea | Chaque lettre gardée ; une boucle quand deux nombres consécutifs sont égaux | Le chemin suit le mot tel qu'il est écrit |
| Réduction de Spare | Doublons toujours retirés, voyelles par défaut, Y gardé | Méthode de Spare, avec une option pour les mots pauvres en consonnes |
| Un seul mot | L'intention est un mot de 24 lettres au plus | Au-delà d'un mot, le sigil devient illisible |
| Rune liée | Spare compose une rune liée sur une hampe verticale, lettres redessinées en segments droits | Remplace une superposition libre jugée brouillonne |
| Score de la rune | Pénalité : hachures d'abord, puis encre, silhouette, symétrie, équilibre, croisements, encombrement, petites lettres | Des runes propres pour deux à quatre lettres retenues |
| Déterminisme | Graine = empreinte de la méthode, des lettres retenues, de l'option de voyelles et de la variante ; `cyrb53` + `mulberry32` maison | Mêmes réglages, même sigil, testable sans dépendance |
| Squelettes des lettres | Hershey Roman Simplex, converti une fois en module TypeScript | Trait unique de qualité, libre d'usage avec attribution |
| PNG | Rastérisé à partir du SVG par un canvas, à l'export seulement | L'écran reste 100 % SVG |
| PDF | Toujours un pochoir ; taille = plus grande dimension de l'encre ; 1–25 cm, 8 cm par défaut ; `pdf-lib` chargé à la demande | Ce qu'un tatoueur mesure à la règle |
| Hors ligne | `vite-plugin-pwa` (Workbox) met en cache tout le build | PWA installable sans service worker écrit à la main |
| i18n | Dictionnaire typé maison | Deux langues, quelques dizaines de chaînes |
| Thème | Système / Encre sur papier / Or sur noir ; enregistré seulement s'il est choisi | Permet de revenir au réglage du système |
