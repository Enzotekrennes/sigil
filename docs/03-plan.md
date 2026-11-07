# Plan technique — Sigil
Statut : validé le 2026-11-07

## Stack
| Brique | Choix | Pourquoi |
|---|---|---|
| Automatisations | Aucune | Pas de flux serveur ; seul le déploiement est automatisé (GitHub Actions) |
| Front | React 19 + TypeScript strict + Vite, rendu SVG | Choix d'Enzo (vitrine employabilité) ; Vite produit un site statique léger |
| Back | Aucun | L'intention ne quitte jamais le navigateur |
| Données | Modules TS statiques (carrés, glyphes) ; `localStorage` pour thème et langue seulement | Rien à persister côté serveur ; l'intention n'est jamais stockée |
| Hors ligne | `vite-plugin-pwa` (Workbox, précache de tout le build) | PWA installable sans écrire un service worker à la main |
| PDF | `pdf-lib` (`drawSvgPath`) | Dessine nos chemins en vectoriel à la taille exacte en points ; pas de rastérisation |
| PNG | SVG sérialisé → `Image` → canvas hors écran (export uniquement) | Aucun paquet ; l'affichage reste 100 % SVG |
| i18n | Dictionnaire typé maison FR/EN | Deux langues, quelques dizaines de chaînes : une bibliothèque serait disproportionnée |
| Aléatoire | Hash `cyrb53` + PRNG `mulberry32` maison (~20 lignes) | Déterminisme garanti et testable, sans dépendance |
| Qualité | ESLint flat (`typescript-eslint` strictTypeChecked, `eslint-plugin-jsdoc`), Prettier, Vitest + Testing Library, Playwright | Conventions TypeScript du kit |
| Hébergement | GitHub Pages (`base: '/sigil/'`), déploiement par GitHub Actions | Gratuit, statique, cohérent avec la vitrine GitHub |

## Décisions
| # | Décision | Options rejetées | Raison |
|---|---|---|---|
| D1 | SPA React + Vite | Next.js (export statique), Svelte | Pas de serveur ni de routes : Next n'apporte rien ; React demandé par Enzo. Les règles Next.js du kit (Server Components, Server Actions) ne s'appliquent pas |
| D2 | Conversion kamea : `((rang − 1) mod N²) + 1`, A=1 … Z=26, pour les 7 carrés | Réduction pythagoricienne partout (→ Plus tard), gématrie hébraïque | Validé par Enzo ; règle affichée dans le panneau explicatif |
| D3 | Kamea : lettres normalisées sans retrait ; boucle quand deux nombres consécutifs sont identiques | Retrait des doublons comme Spare | Le tracé suit l'intention telle quelle ; la boucle signale aussi les lettres différentes qui tombent sur la même case |
| D4 | Spare : retrait des lettres en double toujours, des voyelles par défaut (option pour les garder) | Voyelles gardées par défaut | Méthode décrite par Spare ; option pour les intentions trop courtes |
| D5 | Normalisation : NFD + suppression des diacritiques, majuscules, A–Z seulement ; autres caractères ignorés et signalés | Refus de toute saisie non A–Z | Les intentions en français contiennent des accents |
| D6 | Graine = hash(méthode, planète, lettres retenues, options, n° de variante) | Graine = texte brut | « Je suis calme » et « je suis calme ! » donnent le même sigil |
| D7 | Squelettes de lettres : Hershey Roman Simplex, données converties une fois en module TS, avec avis d'attribution | Tracer 26 squelettes à la main | Trait unique de qualité, libre d'usage sous condition d'attribution (Hershey/NBS et James Hurt), confirmé en T6 : compatible MIT |
| D8 | Confidentialité : aucun appel réseau, CSP en balise `<meta>` (`default-src 'self'`), intention ni dans l'URL ni dans le stockage, nom de fichier exporté sans l'intention | En-têtes HTTP | GitHub Pages ne permet pas d'en-têtes personnalisés |
| D9 | PNG par canvas à l'export uniquement | Bibliothèque de rastérisation | L'hypothèse « 100 % SVG » vaut pour l'affichage ; le PNG exige une rastérisation |
| D10 | Polices EB Garamond + IBM Plex Mono, accent rouge en clair, fond uni, thème initial = système | Jost, encre seule, grain de papier, or sur noir imposé | Recommandations `design` validées par Enzo |
| D11 | Spare : Y n'est pas une voyelle (gardée) ; voyelles = A E I O U | Y retirée | Y souvent consonne (« yeux », « you ») ; garde une lettre de plus sur les intentions courtes |
| D12 | CSP `style-src 'self'` sans `'unsafe-inline'` : styles dynamiques uniquement par la prop `style` React (CSSOM), jamais d'élément `<style>` ni d'attribut `style=""` en dur ; meta CSP retirée sur le serveur de dev seulement | `'unsafe-inline'` | Prouvé par test e2e ; garde la CSP stricte en production |
| D13 | Spare : score = équilibre (1) + remplissage (1) + lisibilité par lettre (4 × déficit de recouvrement, orientations lisibles pénalisées) + rétrécissement (20) ; décalage ±0,1, échelle 0,7–1, 24 à 96 candidats (budget 480 lettres-candidats) ; recentrage sur le centre de gravité puis ajustement dans un disque de rayon 40 ; aucune marque ; critère « aucune lettre lisible » non applicable à 1–2 lettres | Termes isolement / lettre droite (refusés au test F2 n° 1), cadrage carré | La méthode de Spare n'a pas de sens de lecture ; ce sont les traits qui longent une lettre, pas ceux qui la croisent, qui la dissolvent |
| D14 | Variantes affichées à partir de 1 ; kamea méthode par défaut ; changer planète ou option ne retrace pas (bouton Tracer) | Numérotation à 0, Spare par défaut, retracé automatique | Plus lisible pour le public ; évite une animation relancée à chaque clic |
| D15 | Marques kamea : suivent l'épaisseur jusqu'à un plafond relatif à la case (boucle ≤ 45 %, cercle de départ ≤ 30 %, trait d'arrivée ≤ 60 %) ; boucle finale à côté du dernier segment avec un écart = épaisseur (≤ 1,2) ; épaisseur max du curseur ramenée à 2,4 | Recul porté par le point d'attache, marques non plafonnées, épaisseur jusqu'à 4 | À 4, les marques ne tiennent plus dans les cases de la Lune et le sigil devient illisible |

## Architecture
### Flux
- Saisie → `intention.normalize` (lettres retenues, caractères ignorés) → méthode :
  - kamea : lettres → nombres (D2) → cases du carré → polyligne + marques (départ, arrivée, boucles) ;
  - Spare : lettres → réduction (D4) → glyphes Hershey → N compositions candidates (graine D6) → score d'équilibre → meilleure → simplification ;
- → modèle `Sigil` (traits + marques + étapes explicatives) → `SigilRenderer` (SVG animé, style) + panneau explicatif.
- `Sigil` + style → export SVG (sérialisation) / PNG (canvas) / PDF (pdf-lib, taille en cm).
- Rien ne sort du navigateur ; seuls le thème et la langue vont dans `localStorage`.

### Modèle de données
- `Intention` : `{ source: string; letters: string[]; ignored: string[] }`.
- `Sigil` : `{ strokes: Point[][]; marks: Mark[]; viewBox: Box; steps: ExplanationStep[]; seed: number }` (coordonnées dans un repère carré normalisé 0–100).
- `Mark` : `start-circle | end-bar | loop` avec position et orientation.
- `ExplanationStep` : union discriminée par méthode (lettres retirées, table lettre → nombre, carré avec chemin, glyphes avant fusion, transformations appliquées).
- `StyleOptions` : épaisseur, extrémités (arrondies/carrées), cercle d'encadrement, thème, mode pochoir.

### Structure
```
src/
  app/                  # App.tsx, assemblage de l'écran
  features/intention/   # normalisation et réduction
  features/kamea/       # carrés d'Agrippa, conversion, tracé
  features/spare/       # glyphes Hershey, composition, score, simplification
  features/sigil/       # types communs, SigilRenderer, animation, style
  features/explain/     # panneau « comment c'est fait »
  features/export/      # SVG, PNG, PDF
  features/i18n/        # dictionnaires FR/EN
  components/ui/        # Button, Field, Select, Toggle, Slider…
  lib/random.ts         # cyrb53 + mulberry32
  styles/tokens.css
```

### Points d'entrée externes
Aucun. Pas d'API, pas de formulaire envoyé, pas de requête réseau hors chargement des fichiers du site.

## Design
Voir `docs/design.md` et `src/styles/tokens.css`. Page de grimoire : beaucoup de vide, le sigil seul au centre, trait fin constant (fine line), sans dégradé ni lueur.
- Polices (SIL OFL 1.1, servies localement) : EB Garamond pour les titres, IBM Plex Mono pour l'interface et les nombres.
- Thèmes : « encre sur papier » (accent rouge de rubrique, jamais sur le sigil) et « or sur noir » ; thème initial calé sur le réglage du système. Pochoir : noir pur sur blanc pur.
- Contrastes AA vérifiés et chiffrés dans `design.md`.

## Fonctionnalités
### F1 — Sigil par carré magique (kamea)
- Étant donné l'intention « Je suis calme » et la planète Saturne, quand je valide, alors le sigil relie les cases 1,5,1,3,9,1,3,1,3,4,5 (réduction pythagoricienne), avec un cercle au départ et un trait perpendiculaire à l'arrivée.
- Étant donné deux lettres consécutives donnant le même nombre, quand le sigil est tracé, alors une boucle marque la case.
- Étant donné une même intention, planète et réglages, quand je recharge la page et recommence, alors le SVG produit est identique.
- Étant donné le panneau « comment c'est fait », quand un sigil kamea est affiché, alors il montre la règle de conversion, la table lettre → nombre et le carré avec le chemin.
- Étant donné une intention vide ou sans lettre latine (« 123 ! »), quand je valide, alors un message clair s'affiche et aucun sigil n'est tracé.
- Test : [x] VALIDÉ (2026-11-07)

### F2 — Sigil par la méthode de Spare
- Étant donné l'intention « Je suis calme », quand je choisis Spare, alors le panneau montre les lettres retirées (doublons, voyelles) et les lettres retenues J S C L M.
- Étant donné une même intention et des réglages identiques, quand je recommence après rechargement, alors le sigil est identique.
- Étant donné un sigil affiché, quand je clique « autre variante », alors un sigil différent s'affiche, et la variante n est la même à chaque fois.
- Étant donné un sigil Spare, quand il est affiché, alors il tient dans le cadre, son centre de gravité est proche du centre (écart < 10 % du côté) et aucune lettre n'est lisible isolément (jugement visuel noté par test d'acceptation).
- Étant donné une intention dont il ne reste aucune consonne (« oui »), quand je valide, alors un message propose de garder les voyelles.
- Test : [x] VALIDÉ (2026-11-08, passage n° 2)

### F3 — Tracé animé et réglages de style
- Étant donné un nouveau sigil, quand il s'affiche, alors il se trace progressivement dans l'ordre du chemin, puis les marques apparaissent.
- Étant donné `prefers-reduced-motion: reduce`, quand un sigil s'affiche, alors il apparaît sans animation.
- Étant donné un sigil affiché, quand je change l'épaisseur, les extrémités ou le cercle d'encadrement, alors le rendu se met à jour sans changer la forme.
- Étant donné un sigil affiché, quand je clique « rejouer », alors l'animation recommence.
- Test : [ ] VALIDÉ

### F4 — Exports SVG et PNG
- Étant donné un sigil affiché, quand j'exporte en SVG, alors le fichier s'ouvre dans un navigateur et un éditeur vectoriel avec le même rendu et le style choisi.
- Étant donné un sigil affiché, quand j'exporte en PNG, alors j'obtiens une image carrée nette (2048 px), fond selon le thème.
- Étant donné un export, quand je regarde le nom du fichier et son contenu, alors l'intention n'y figure pas.
- Étant donné qu'aucun sigil n'est affiché, quand je regarde les boutons d'export, alors ils sont désactivés.
- Test : [ ] VALIDÉ

### F5 — Mode pochoir et PDF à taille réelle (Important)
- Étant donné le mode pochoir, quand il est activé, alors le sigil est en noir pur, trait unique, sans cercle décoratif ni fond.
- Étant donné une taille de 6 cm, quand j'exporte le PDF, alors le sigil mesure 6 cm (± 0,5 mm) sur une page A4, avec une règle de contrôle de 1 cm.
- Étant donné une taille hors plage (< 1 cm ou > 25 cm), quand je saisis la valeur, alors un message indique la plage et l'export est bloqué.
- Étant donné le mode pochoir, quand je règle l'épaisseur, alors elle est exprimée en mm (0,6 par défaut, plage 0,3 à 1,2) et respectée dans le PDF.
- Test : [ ] VALIDÉ

### F6 — Thèmes et interface FR/EN (Important)
- Étant donné le premier chargement avec un navigateur en anglais, quand la page s'ouvre, alors l'interface est en anglais ; sinon en français.
- Étant donné un changement de langue ou de thème, quand je recharge, alors le choix est conservé.
- Étant donné le thème « or sur noir », quand je l'active, alors les textes respectent le contraste AA.
- Test : [ ] VALIDÉ

### F7 — App hors ligne, confidentielle et déployable
- Étant donné une première visite, quand je coupe le réseau et recharge, alors l'app fonctionne entièrement.
- Étant donné un parcours complet (saisie, tracé, exports), quand j'observe le réseau, alors aucune requête ne sort hors des fichiers du site.
- Étant donné une intention saisie, quand je regarde l'URL et le stockage du navigateur, alors l'intention n'y figure pas.
- Étant donné le build, quand le workflow de déploiement s'exécute, alors le site est servi sous `/sigil/` sans lien cassé (vérifié en local avec `vite preview --base /sigil/`).
- Test : [ ] VALIDÉ

## Tâches
| ID | Fonct. | Tâche | Rôle | Dépend de | Périmètre | Fini quand | État |
|---|---|---|---|---|---|---|---|
| T1 | F7 | Socle : Vite + React + TS strict, ESLint/Prettier/jsdoc, Vitest, Playwright, structure `src/`, `base: '/sigil/'`, LICENSE MIT, import de `tokens.css`, polices EB Garamond et IBM Plex Mono en `woff2` local + `OFL.txt` + `src/styles/fonts.css` | dev | — | racine, `src/`, configs, `src/assets/fonts/` | `lint`, `typecheck`, `test`, `build` verts ; page d'accueil vide servie en `preview` || [x] |
| T2 | F1 | Normalisation et réduction de l'intention (D4, D5), avec trace des lettres retirées et ignorées | dev | T1 | `features/intention/` | Tests : accents, doublons, voyelles, option voyelles, saisies vides ou non latines || [x] |
| T3 | F1 | Types `Sigil` communs ; 7 carrés d'Agrippa ; conversion D2 ; chemin, marques départ/arrivée, boucles (D3) ; étapes explicatives | dev | T1 | `features/sigil/types.ts`, `features/kamea/` | Tests : sommes magiques des 7 carrés, valeurs comparées à la source citée, scénario « Je suis calme » Saturne, boucle, moins de 2 lettres → erreur || [x] |
| T4 | F3 | `SigilRenderer` : SVG, animation du tracé (longueurs précalculées), marques, options de style, `prefers-reduced-motion`, rejouer | dev | T3 | `features/sigil/` | Tests composant : rendu, style, absence d'animation en mouvement réduit || [x] |
| T5 | F7 | PWA (`vite-plugin-pwa`), CSP `<meta>`, aucune ressource externe, workflow GitHub Actions Pages (non déclenché) | dev | T1 | `vite.config.ts`, `index.html`, `.github/workflows/` | e2e Playwright : hors ligne après 1re visite ; aucune requête externe ; build sous `/sigil/` || [x] |
| T6 | F2 | Données Hershey Roman Simplex A–Z : source, vérification de licence, script de conversion versionné, module TS généré, fichier d'attribution | dev | T1 | `features/spare/glyphs/`, `scripts/`, `NOTICE` | Licence citée et compatible MIT consignée en rapport ; 26 glyphes testés (trait unique, boîte englobante) || [x] |
| T7 | F1 | Écran principal : saisie, choix méthode/planète, scène, panneau explicatif kamea (table, règle, carré + chemin), états d'erreur | design | T2, T3, T4 | `app/`, `features/explain/`, `components/ui/` | Captures 375/768/1440, parcours clavier, contrastes ; scénarios F1 joués à la main || [x] |
| T8 | F2 | Spare 1/2 : PRNG (`lib/random.ts`), placement et transformations des glyphes (rotation, miroir, échelle, chevauchement), génération de candidats | dev | T2, T6 | `lib/random.ts`, `features/spare/` | Tests : déterminisme, variantes distinctes, candidats dans le cadre || [x] |
| T9 | F2 | Spare 2/2 : score d'équilibre (centre de gravité, encombrement, chevauchement), fusion des traits proches, simplification, étapes explicatives | dev | T8 | `features/spare/` | Tests : critère de centre de gravité F2, aucun segment dupliqué ; planche de 12 exemples SVG générée pour le journal || [x] |
| T10 | F2 | Intégration Spare dans l'écran : option voyelles, « autre variante », panneau étapes Spare | design | T7, T9 | `app/`, `features/explain/` | Scénarios F2 joués à la main, captures || [x] |
| T11 | F3 | Panneau réglages de style et bouton rejouer | design | T7 | `features/sigil/`, `components/ui/` | Scénarios F3 joués à la main, captures || [x] |
| T12 | F4 | Exports SVG et PNG, boutons, nom de fichier neutre ; couleurs du thème écrites en littéral (pas de `var()`) | dev | T4, T7 | `features/export/` | Tests : SVG valide, PNG 2048 px, aucune trace de l'intention || [x] |
| T13 | F5 | Mode pochoir et PDF A4 à taille réelle avec règle de contrôle ; dialogue « Exporter » de design.md (format SVG/PNG/PDF, résolution PNG 1024/2048/4096) remplaçant les deux boutons ; état chargement visuel de `Button` | dev | T12 | `features/export/`, `features/sigil/` | Test : dimensions du chemin dans le PDF = taille demandée ± 0,5 mm ; plage refusée | [ ] |
| T14 | F6 | i18n FR/EN (dictionnaire typé, détection, persistance) sur toutes les chaînes | dev | T10, T11 | `features/i18n/`, chaînes de l'UI | Test : aucune chaîne en dur hors dictionnaires ; bascule et persistance | [ ] |
| T15 | F6 | Sélecteur de thème encre / or, finition des deux thèmes | design | T14 | `styles/`, `app/` | Captures des deux thèmes aux 3 largeurs, contrastes AA chiffrés | [ ] |
| T16 | F1 | Boucles kamea proportionnées à la taille des cases (lisibles du 3×3 au 9×9), pas de boucles superposées sur une même case, pas de collision boucle / trait d'arrivée | dev | T7 | `features/kamea/` | Tests sur les 7 carrés + capture Lune « Belle allée » lisible || [x] |
| T17 | F3 | Recul de la boucle finale kamea exprimé en fraction de l'épaisseur du trait : pas de contact boucle / trait d'arrivée de 0,4 à 4 | dev | T11 | `features/kamea/` (+ `sigil/style.ts` si l'API `scaleMark` doit l'exprimer) | Test sur 7 carrés × épaisseurs 0,4 / 1,2 / 4 : écart bord à bord > 0 || [x] |
| T18 | F2 | Variété des compositions Spare : éviter la dérive horizontale et les structures répétées d'une variante à l'autre (terme d'allongement, diversité des orientations) sans perdre la lisibilité acquise | dev | — | `features/spare/` | Planche 16 cas : ratio largeur/hauteur moyen ≤ 1,15 ; variantes de silhouettes distinctes ; critère lisibilité F2 inchangé || [x] |
| T19 | F3 | Durée totale du tracé animé plafonnée (levers de plume et vitesse ajustés au nombre de traits) | dev | T17 | `features/sigil/`, `styles/tokens.css` | Test : durée ≤ plafond pour 1 à 40 traits ; ordre du tracé inchangé || [x] |

Ordre : T1 → (T2, T3, T5, T6 en parallèle, 3 max) → T4 → T7 → test F1 (J2) → T8 → T9 → T10 → test F2 (J3) → T11 → test F3 → T12 → test F4 → test F7 → T13, T14, T15 → tests F5, F6 (J4).

## Risques
- Qualité esthétique de Spare difficile à garantir par des critères chiffrés : planche de 12 exemples consignée au journal pour un jugement visuel, ajustement des poids du score si besoin.
- Licence Hershey : si l'attribution n'est pas compatible, repli sur des squelettes tracés à la main (environ 1 tâche en plus).
- Valeurs des carrés d'Agrippa : des éditions comportent des coquilles ; les tests de sommes magiques et la comparaison à une source citée les détectent.
- Délai serré (2026-11-21) : F5 et F6 basculent en V1.1 si J4 glisse.
- Pas d'en-têtes HTTP sur GitHub Pages : CSP en `<meta>`, sans `frame-ancestors` (limite acceptée, aucune donnée sensible exposée).
