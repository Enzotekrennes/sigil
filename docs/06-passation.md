# Passation — Sigil
Statut : brouillon

## Livré
Un site statique, utilisable hors ligne et installable (PWA), qui transforme un mot en sigil :
- **Carré magique (kamea)** : 7 carrés planétaires d'Agrippa, conversion A=1 … Z=26 modulo N², chemin avec cercle de départ, trait d'arrivée et boucles.
- **Méthode de Spare en rune liée** : doublons et voyelles retirés, lettres redessinées en traits droits, accrochées à une hampe centrale ; variantes déterministes.
- Tracé animé (≤ 3 s, pas-à-pas en mouvement réduit), panneau « comment c'est fait », réglages de style (épaisseur, extrémités, cercle d'encadrement).
- Exports SVG, PNG (1024 à 4096 px) et PDF A4 à taille réelle en mode pochoir tatouage (règle de contrôle de 1 cm).
- Interface français / anglais, thèmes « encre sur papier » et « or sur noir ».
- Confidentialité : le mot ne quitte jamais le navigateur (aucun serveur, aucune mesure d'audience, rien dans l'URL, le stockage ni les fichiers exportés).

## Fonctionnement
- Saisie d'un mot → normalisation (accents, ligatures) → méthode → modèle `Sigil` → rendu SVG et exports, entièrement dans le navigateur.
- Déploiement : à chaque push sur `main`, le workflow `.github/workflows/deploy.yml` lance format, lint, types, tests unitaires, tests du script, build, tests e2e de confidentialité / hors ligne, puis publie `dist/` sur GitHub Pages sous `/sigil/`.
- Mises à jour : le service worker prend la main automatiquement à la visite suivante.

## Comptes et connexions
| Service | Compte / connexion | Propriétaire | Où est le secret |
|---|---|---|---|
| GitHub (dépôt, Actions, Pages) | `Enzotekrennes/sigil` (privé au 2026-11-08), démo prévue sur `https://enzotekrennes.github.io/sigil/` | Enzo | aucun secret : jeton `GITHUB_TOKEN` fourni par Actions, droits minimaux par job |
| Dependabot | activé par `.github/dependabot.yml` | Enzo | aucun |

## Maintenance
- Surveiller : l'onglet Actions (échec du déploiement) et les pull requests de Dependabot (hebdomadaires, groupées).
- En cas de panne : relancer le workflow à la main (Actions → Deploy to GitHub Pages → Run workflow) ; en local, `npm ci --ignore-scripts`, puis `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`.
- Modifier sans casser :
  - textes de l'interface : `src/app/strings.fr.ts` et `strings.en.ts` (le compilateur refuse une clé manquante) ;
  - couleurs et espacements : `src/styles/tokens.css` (le test anti-dérive vérifie les copies dans `vite.config.ts` et `index.html`) ;
  - poids du score Spare : `src/features/spare/runeScore.ts` (relancer la planche de contrôle et les tests) ;
  - ne pas toucher à la main : `src/features/spare/glyphs/hersheyRomanSimplex.ts` (généré par `npm run glyphs:generate`), la CSP de `index.html` sans relancer les e2e de confidentialité.
- Le dépôt doit s'appeler `sigil` (base `/sigil/`) ; sur ce compte GitHub, n'héberger aucun autre site Pages qui exécute du code tiers (origine partagée).

## Limites connues
- Un sigil kamea peut être relu par qui connaît la méthode (signalé dans l'app).
- Spare en rune liée : rendu le plus proche des références pour 2 à 4 lettres retenues ; au-delà de 5, le signe devient un mât plus chargé.
- Premier tracé d'une page : 170 à 190 ms pour 12 lettres à processeur ralenti ×4 (les suivants restent sous 100 ms).
- Testé sur Chromium uniquement ; impression papier réelle et lecteurs PDF grand public non vérifiés.
- La CSP est en balise `<meta>` (GitHub Pages ne permet pas d'en-têtes) : pas de `frame-ancestors`.

## Recommandations
- Imprimer un PDF test à 100 % et mesurer la règle de 1 cm avant la première séance chez un tatoueur.
- Plus tard (roadmap) : domaine dédié (isolement de l'origine), Trusted Types dans la CSP, fusion des tests e2e en double, refactorings listés en review, réduction pythagoricienne pour tous les carrés, roue rose-croix, export traceur, galerie locale.
- Ajouter des mentions légales d'éditeur si le site est présenté comme vitrine professionnelle.
