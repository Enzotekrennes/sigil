# Journal de build — Sigil

## 2026-11-07 — T1 Socle
- Rôle : dev
- Fait : Vite 8, React 19.3, TypeScript 6.0 strict ; ESLint (strictTypeChecked, react-hooks, jsdoc), Prettier, Vitest + Testing Library, Playwright (Chromium, preview sous `/sigil/`) ; polices EB Garamond et IBM Plex Mono en woff2 local (Fontsource 5.3.0) avec OFL ; LICENSE MIT, `.gitattributes` en LF.
- Vérifications : `lint`, `typecheck`, `test` (2/2), `build`, `test:e2e` (1/1, police chargée en local) → verts, revérifiés au contrôle sauf e2e.
- Écarts au plan : polices dans `src/assets/fonts/` (versionnées par Vite) ; ajout de `base.css`, `App.css`, `src/test/setup.ts` ; TypeScript 6.0 (typescript-eslint ne prend pas encore 7), jsdom 29 et eslint-plugin-jsdoc 63 (Node 24.14 sur la machine).
- Points ouverts : 10 vulnérabilités moyennes `minimatch` dans l'outillage ESLint uniquement (rien dans le build) ; Node ≥ 24.15 permettrait de monter jsdom et jsdoc.

## 2026-11-07 — T2 Normalisation et réduction de l'intention
- Rôle : dev
- Fait : `normalizeIntention` (NFD, ligatures œ/æ/ß, A–Z, caractères ignorés listés) et `reduceForSpare` (doublons puis voyelles, motif par lettre retirée) ; erreurs typées `EMPTY_INTENTION`, `NO_LATIN_LETTER`, `NO_LETTER_LEFT` (+ `suggestKeepVowels`).
- Vérifications : eslint + vitest sur `src/features/intention` → 21/21 verts (revérifié au contrôle).
- Écarts au plan : aucun ; décision D11 (Y gardée).
- Points ouverts : caractères de compatibilité (« ﬁ », pleine chasse) ignorés plutôt que convertis (NFKD possible si besoin) ; messages utilisateur FR/EN à écrire en T7/T10/T14.

## 2026-11-07 — T3 Modèle Sigil et kamea
- Rôle : dev
- Fait : types communs (`sigil/types.ts`, repère 0–100) ; 7 carrés d'Agrippa (De occulta philosophia II, 22 ; disposition vérifiée sur Wikipedia « Magic square ») ; conversion D2 ; chemin, cercle de départ, trait d'arrivée perpendiculaire, boucle par suite de nombres identiques ; étapes explicatives ; erreurs `TOO_FEW_LETTERS`/tracé impossible/`INVALID_LETTER`.
- Vérifications : eslint + vitest sur kamea et sigil → 72/72 verts (revérifié au contrôle).
- Écarts au plan : erreur `INVALID_LETTER` ajoutée ; une boucle par suite (AAA → 1 boucle) ; kamea `seed = 0`.
- Points ouverts : tailles des marques figées pour l'épaisseur 1,2 → mise à l'échelle confiée à T4 ; boucle débordant des cases de la Lune → à juger en T7 ; lint global rouge à cause de `vite.config.ts` (T5 en cours).

## 2026-11-07 — T6 Glyphes Hershey
- Rôle : dev
- Fait : 26 majuscules Roman Simplex converties en polylignes (unités Hershey, base y = 0) ; `getGlyph` ; script `scripts/generate-hershey-glyphs.js` (logique testée dans `hersheyConversion.ts`) ; `NOTICE` (Hershey + OFL).
- Licence : avis Usenet mod.sources vol. 4 n° 42 (1986) — usage libre y compris commercial, à condition de joindre les mentions A. V. Hershey (NBS) et James Hurt (Cognition, Inc.) et de ne pas convertir au format NTIS. Compatible MIT. Données identiques octet pour octet à la publication de 1986.
- Vérifications : eslint + vitest spare → 103/103 verts (revérifié) ; régénération idempotente (sha256 identique).
- Écarts au plan : script en `.js` important le `.ts` (évite de toucher tsconfig/eslint).
- Points ouverts : script npm `glyphs:generate` à ajouter ; mise à l'échelle Hershey → repère 0–100 en T8 ; lien NOTICE dans le README (phase 6).

## 2026-11-07 — T5 PWA, CSP et déploiement
- Rôle : dev
- Fait : `vite-plugin-pwa` 2.0.0 (generateSW, autoUpdate, 21 fichiers précachés), manifest et icônes (tracé kamea encre sur papier) ; CSP `<meta>` stricte (`default-src 'self'`, `form-action 'none'`, `object-src 'none'`, `base-uri 'none'`) + `referrer no-referrer` ; workflow `.github/workflows/deploy.yml` (inactif tant que le dépôt n'existe pas).
- Vérifications : e2e 7/7 (hors ligne servi par le service worker, aucune requête tierce, CSP appliquée, ressources sous `/sigil/`) — revérifié au contrôle ; contre-épreuve sans service worker → test hors ligne rouge.
- Écarts au plan : CSP retirée sur le serveur de dev seulement (plugin) ; `skipWaiting`/`clientsClaim` explicites ; apple-touch-icon ajoutée. Décision D12.
- Points ouverts : e2e non lancés en CI (à ajouter en phase 6 si souhaité) ; régler Pages → Source « GitHub Actions » en phase 6 ; 15 vulnérabilités low/moderate dans l'outillage de build uniquement.

## 2026-11-07 — T4 SigilRenderer
- Rôle : dev
- Fait : rendu SVG (un `path` par polyligne, marques mises à l'échelle `strokeWidth / 1.2`, cercle d'encadrement), animation ordonnée (départ, tracé `pathLength=1`, marques, cadre), mouvement réduit → fondu, rejouer via `replayToken` ; `StyleOptions` (`strokeWidth`, `roundEnds`, `frameCircle`, `mode`).
- Vérifications : eslint + vitest sigil → 41/41 verts (revérifié) ; aucune violation D12.
- Écarts au plan : thème hors `StyleOptions` (global par `data-theme`).
- Points ouverts : export (T12) doit nettoyer le SVG (styles `--trace-*`, classes, `pathLength`) et écrire les couleurs en littéral ; constante 1,2 dupliquée kamea/sigil (refactor) ; pas à pas en mouvement réduit et rendu réel de l'animation à vérifier en T7/T11 ; le parent doit mémoriser le `Sigil`.

## 2026-11-07 — T8 Spare 1/2 (graine, placement, candidats)
- Rôle : dev
- Fait : `lib/random.ts` (cyrb53, mulberry32, utilitaires) ; `spareSeed` (D6) ; placement par miroir + quarts de tour (8 orientations), échelle 0,55–1, décalage ±0,25, partage de barre verticale ; 24 candidats mis au cadre 10–90 avec trace des transformations par lettre.
- Vérifications : eslint + vitest lib/spare → 163/163 verts (revérifié) ; planche visuelle J S C L M contrôlée (scratchpad).
- Écarts au plan : `strokeLetters` exposé ; erreurs `DUPLICATE_LETTER`, `INVALID_VARIANT`.
- Points ouverts pour T9 : centre de gravité non équilibré (seule la boîte est centrée) ; certaines lettres restent lisibles isolément ; segments colinéaires à fusionner ; constantes de cadre dupliquées avec kamea (refactor) ; étapes explicatives Spare à typer.

## 2026-11-07 — T9 Spare 2/2 (score, fusion, buildSpareSigil)
- Rôle : dev
- Fait : score D13, sélection, fusion des segments colinéaires et points proches, recentrage sur le centre de gravité, `buildSpareSigil` avec 4 étapes explicatives ; constantes de cadre communes dans `sigil/frame.ts` (kamea, style, spare).
- Vérifications : suite complète 403/403, lint, typecheck, e2e 11/11 verts (revérifié) ; 52 intentions × 3 variantes : centre de gravité centré, 18 ms max par sigil (poste fixe) ; planche de 12 sigils jugée équilibrée, 2/12 gardent une lettre lisible.
- Écarts au plan : terme « lettre droite » ajouté au score ; `marks: []`.
- Points ouverts : symétrie testée exactement (B, E, K, S Hershey non reconnues symétriques) ; performance téléphone à mesurer en T10.

## 2026-11-07 — T7 Écran principal et panneau kamea
- Rôle : design
- Fait : écran (saisie, méthode, 7 planètes, Tracer, scène, Rejouer), panneau en 4 étapes (lettres, règle D2 avec exemple, table lettre → rang → case, carré avec chemin et marques), erreurs en français, composants `ui/`, textes centralisés dans `app/strings.fr.ts`, Spare visible mais désactivé.
- Vérifications : suite complète, lint, typecheck, build, e2e 11/11 verts (revérifié) ; captures 375/768/1440, animation réelle chronométrée (départ → tracé → arrivée), parcours clavier, contrastes AA chiffrés.
- Écarts au plan : grille kamea seulement dans le panneau ; panneau repliable à toutes largeurs ; nombres de la grille en coin de case (lisibilité) ; pas de retracé automatique au changement de planète.
- Points ouverts : boucles trop grandes sur la Lune 9×9 → tâche T16 ajoutée ; avertissement « caractères ignorés » affiché deux fois (à dédoublonner en T10) ; panneau synchronisé au tracé et pas-à-pas en mouvement réduit → T11.

## 2026-11-07 — T16 Boucles kamea
- Rôle : dev
- Fait : marques × min(1, case / 18) (Saturne et Jupiter inchangés ; Lune : boucle 3,6 → 1,78 de rayon), cercle de départ plancher 2,4 ; une seule boucle par case ; boucle finale reculée et placée à l'opposé du trait d'arrivée.
- Vérifications : eslint kamea + vitest `src/features` → 386/386 verts (revérifié) ; capture Lune « Belle allée » lisible.
- Points ouverts : boucle sur la case de départ croise le cercle de départ (préexistant) ; écart boucle / trait d'arrivée à revérifier avec un trait épais (T11).

## 2026-11-07 — T10 Spare dans l'écran
- Rôle : design
- Fait : Spare activé, interrupteur « Garder les voyelles », « Autre variante » (numéro affiché), panneau Spare en 4 étapes (lettres retirées, squelettes et transformations, composition retenue, simplification), erreur « oui » avec action directe, avertissement « caractères ignorés » à un seul endroit ; composant `Switch`.
- Vérifications : lint, typecheck, 474/474 tests, e2e 14/14 verts (revérifié) ; captures 375/768/1100/1440 clair et sombre ; contrastes AA ; `buildSpareSigil` ≤ 90 ms en CPU ×4.
- Écarts au plan : décision D14.
- Points ouverts : espacement du panneau kamea en deux colonnes (1024–1279 px) ; 240 ms du clic au premier affichage à mesurer sur téléphone.

## 2026-11-07 — F1 Kamea : test
- Verdict : VALIDÉ (passage n° 1)
- Preuves : 5 scénarios OK (chemin Saturne 1,5,1,3,9,1,3,1,3,4,5, barre perpendiculaire, boucles, SVG identique après rechargement, panneau et 7 carrés conformes à Agrippa, erreurs claires) ; confidentialité (URL, stockage, DOM, réseau) et CSP OK ; 375 px OK.
- Bugs renvoyés (mineurs, ajoutés à T11) : B1 accord singulier du message `noLatinLetter` ; B2 chiffres de la grille du panneau barrés par le chemin.
- Tests e2e ajoutés : `e2e/f1-acceptance.spec.ts` (27 tests).
- Non testé : navigateurs hors Chromium, 768 px.

## 2026-11-07 — F2 Spare : test
- Verdict : REFUSÉ (passage n° 1) — scénario 4 : 6/16 sigils gardent une lettre nettement lisible (C de « Je suis calme », A de « Je trouve ma voie »). Scénarios 1, 2, 3, 5, confidentialité, CSP, 375 px, clavier : OK.
- Bugs renvoyés : lisibilité → dev (reprise T9 : mesure de recouvrement par lettre, seuil, test) ; cercle d'encadrement débordé par le dessin → design (T11, mise à l'échelle dans le renderer).
- Décision : critère « aucune lettre lisible » non applicable aux intentions de 1 ou 2 lettres retenues (ex. « Yeux » → Y X).
- Tests e2e ajoutés : `e2e/f2-acceptance.spec.ts` (10 tests).

## 2026-11-08 — T11 Réglages de style et rejouer
- Rôle : design
- Fait : panneau « Style » (épaisseur 0,4–4 pas 0,2, extrémités, cercle), pas-à-pas en mouvement réduit, cercle d'encadrement qui contient le dessin (`frameFitScale`, écart ≥ 2 épaisseurs), espacement du panneau kamea en deux colonnes, B1 (accord singulier) et B2 (pastilles derrière les chiffres de la grille) du test F1.
- Vérifications : eslint + vitest sur ses dossiers → 107/107 verts (revérifié) ; e2e 58/58 sur un build sans tsc ; captures 375–1440 clair/sombre.
- Écarts au plan : aucun ; seuils fin/moyen/épais 1,4 / 2,6 ; « Style » ouvert d'office dès 1024 px.
- Points ouverts : boucle finale kamea touche le trait d'arrivée dès 1,6 d'épaisseur → T17 ajoutée ; export (T12) doit retirer `--settled` et appliquer `frameFitScale` ; panneau non synchronisé au tracé (plus tard).

## 2026-11-08 — T9 reprise : lisibilité Spare (retour test F2 n° 1)
- Rôle : dev
- Fait : mesure de lisibilité par lettre (`legibility.ts` : recouvrement à 3 unités, orientations familières), nouveau score D13, superposition accrue, nombre de candidats adaptatif, cadrage dans un disque de rayon 40, fusion des segments qui se longent.
- Vérifications : eslint + vitest spare → 216/216 verts (revérifié) ; planche des 16 cas du test : 1 lettre lisible / 15 (+1 limite), « Yeux » exempté ; ≈ 64 ms à CPU ×4.
- Points ouverts : `App.test.tsx` figeait « 24 façons » (correctif en cours) ; un trait colinéaire compte comme recouvrement ; compositions plus horizontales et denses qu'avant (à juger au test F2 n° 2).

## 2026-11-08 — F2 Spare : test
- Verdict : VALIDÉ (passage n° 2)
- Preuves : 5 scénarios OK ; 0 lettre nettement lisible / 15 (2 limites), « Yeux » exempté ; centre de gravité 50/50, tous les points dans le disque de rayon 40 ; premier affichage 22–39 ms (217 ms max à CPU ×4) ; confidentialité, CSP, 375 px, clavier OK.
- Bugs mineurs planifiés : B2 compositions plus horizontales et répétitives (ratio moyen 1,37) → T18 ; B3 tracé animé de ~5,4 s sur 124 lettres → T19.
- Tests e2e : `e2e/f2-acceptance.spec.ts` inchangé, 10/10.

## 2026-11-08 — T17 Marques kamea et épaisseur
- Rôle : dev (passage bloqué puis décision de pilotage : plafonds par case + recul fixe)
- Fait : plafonds des marques par rapport à la case, placement de la boucle finale partagé méthode/rendu, `fitEndLoop` dans `frameFit.ts` (réduction ≥ 0,63, plus d'effondrement), boucles affichées à leur étape dans le pas-à-pas.
- Vérifications : eslint + vitest kamea/sigil → 242/242 verts (revérifié) ; 378 cas (9 intentions × 7 carrés × 3 épaisseurs × cercle) : écart > 0, boucle attachée.
- Écarts au plan : décision D15 ; 2 tests existants ajustés (épaisseur ×1,5, plafond du cercle de départ).
- Points ouverts : Lune illisible à l'épaisseur 4 → curseur plafonné à 2,4 (T19) ; chevauchement de deux boucles voisines avec cercle à forte épaisseur (rare).

## 2026-11-08 — T19 Durée du tracé et épaisseur max
- Rôle : dev
- Fait : durée de tracé plafonnée à 2,7 s (`traceTimeScale`, token `--duration-trace-max`), kamea inchangé ; épaisseur max 2,4 (D15), libellés fin/moyen/épais ajustés.
- Vérifications : vitest sigil + app 174/174, eslint, typecheck verts (sigil revérifié) ; mesure navigateur : Spare 11 traits 3,35 → 2,85 s, 42 traits 5,83 → 2,86 s, kamea 2,70 s inchangé.
- Écarts au plan : texte d'aide de l'épaisseur dans `strings.fr.ts` commité avec T12 (fichier partagé).
- Points ouverts : commentaires des tests kamea mentionnant l'épaisseur 4 « la plus forte proposée » à rafraîchir.

## 2026-11-08 — T18 Variété des compositions Spare
- Rôle : dev
- Fait : orientations pondérées (3/4 couchées), écart en travers de l'axe étroit, lettre « meneuse » par variante (sans état), C N O Q U X Z au centre, terme d'allongement (poids 3), pente de lisibilité plus raide.
- Vérifications : eslint + vitest spare 229/229 verts (revérifié) ; suite complète 682/682 ×3 ; e2e F2 + spare 13/13 ; planche : ratio moyen 1,36 → 1,10, dissimilarité min entre variantes 0,36 → 0,48, 1 lettre lisible / 15 (2 limites) ; ≈ 68 ms à CPU ×4.
- Points ouverts : C encore lisible sur « Je suis calme » v2 (traits colinéaires comptés comme recouvrement) ; intention longue plus large (1,50). Non-régression F2 à rejouer avec le test F3.

## 2026-11-08 — T12 Exports SVG et PNG
- Rôle : dev
- Fait : SVG construit depuis le modèle (mêmes géométries que le rendu, couleurs littérales, fond `--color-surface`, `<title>Sigil</title>`), PNG 2048 px par canvas, téléchargement par Blob URL révoquée, nom `sigil-<méthode>-AAAAMMJJ-HHMMSS`, boutons SVG/PNG désactivés sans sigil.
- Vérifications : eslint + vitest export/app 80/80 (revérifié) ; e2e export 5/5 (PNG 2048×2048 lu dans IHDR, fond clair/sombre au pixel, aucune violation CSP) ; suite e2e 63/64 (échec `style.spec` sur token minifié, confié à l'rôle T19).
- Écarts au plan : deux boutons directs au lieu du dialogue « Exporter » de design.md → reporté dans T13 ; planète absente du nom de fichier.
- Points ouverts : logique d'ajustement dupliquée renderer / export → `fittedDrawing` en cours ; état chargement visuel de `Button` → T13.

## 2026-11-08 — F2 Spare : non-régression après T18 et T19
- Verdict : VALIDÉ (passage n° 3, sur le commit 2aa51b2 en worktree isolé)
- Preuves : 5 scénarios OK ; 0 lettre nettement lisible / 15, 4 cas limites (aucune lettre entière et isolée) ; ratio moyen 1,09 (B2 corrigé) ; tracé ~2,87 s sur 124 lettres (B3 corrigé) ; CSP, confidentialité, 375 px OK.
- Réserve mineure : air de famille (courbe en S + zigzag) entre certaines variantes de « Je suis calme » — non bloquant, à noter en limite connue.

## 2026-11-08 — T14 Interface FR/EN
- Rôle : dev
- Fait : `features/i18n` (détection `navigator.languages`, persistance tolérante `sigil.language` = fr|en, contexte, formatage pluriels/décimales via `Intl`), `strings.en.ts` typé `AppStrings`, sélecteur FR | EN dans l'en-tête, `<html lang>` mis à jour ; l'état (intention, sigil, animation) survit à la bascule.
- Vérifications : 738/738 tests, lint, typecheck verts (revérifié) ; e2e `i18n.spec` 6/6 ; test « aucune chaîne en dur » dans les deux sens, contre-épreuve OK ; captures EN 375/1440.
- Écarts au plan : manifest PWA unique en français ; `playwright.config.ts` en `locale: 'fr-FR'`.
- Points ouverts : deux tests clavier e2e à décaler d'un arrêt (sélecteur de langue) — en cours ; composant commun langue/thème à décider en T15.

## 2026-11-08 — F3 Tracé animé et style : test
- Verdict : VALIDÉ (passage n° 1, commit 2aa51b2 en worktree)
- Preuves : ordre départ → tracé → arrivée chronométré ; mouvement réduit sans tracé ; `d` identique quel que soit le style, cercle = même dessin réduit (résidu < 0,01) ; Rejouer relance ; durée 2,70 s (kamea, 7 planètes) et 2,85 s (Spare 120+ lettres) ; écart dessin / cercle ≥ 2 ; boucle finale / arrivée > 0 de 0,4 à 2,4 ; pas-à-pas correct ; CSP, 375 px, clavier OK.
- Bugs : aucun. Observations : Spare long à 2,4 très dense ; Lune à 2,4 écart boucle / arrivée étroit (1,2).
- Tests e2e ajoutés : `e2e/f3-acceptance.spec.ts` (37 tests), en revalidation sur HEAD avant commit.

## 2026-11-08 — F4 Exports SVG et PNG : test
- Verdict : VALIDÉ (passage n° 1, commit 2aa51b2 en worktree)
- Preuves : 43 SVG en XML strict, autonomes (couleurs littérales, ni classe ni style), < 0,3 % de pixels d'écart avec l'écran ; PNG 2048×2048 opaques, fond exact selon le thème, sans métadonnées texte ; 194 noms de fichiers sans intention ; boutons désactivés sans sigil ; CSP, 375 px, clavier OK ; contrôle de mutation.
- Bug mineur renvoyé à T13 : B1 focus perdu après export PNG au clavier (`disabled` pendant la rastérisation).
- Tests e2e : `e2e/f4-acceptance.spec.ts` (42 tests) — commit différé : à adapter au dialogue d'export de T13 et au sélecteur de langue.
- Non testé : éditeur vectoriel réel (aucun installé), autres navigateurs.

## 2026-11-08 — T13 Pochoir, PDF taille réelle, dialogue d'export
- Rôle : dev
- Fait : mode pochoir (noir pur, épaisseur en mm), PDF A4 vectoriel (pdf-lib 1.17.1, chargé à la demande, métadonnées neutralisées), règle 1 cm et consigne d'impression FR/EN, dialogue « Exporter » accessible (focus piégé, Échap), état chargement de `Button`, bug F4 du focus corrigé (`aria-disabled`).
- Vérifications : lint, typecheck, 814/814 tests, build (22 entrées précachées) verts (revérifié) ; e2e 77/77 hors f3/f4 ; PDF 6 cm relu : encre 60 mm ± 0,5, trait 0,6 mm ; pdf-lib sans eval ni worker, export PDF hors ligne OK.
- Écarts au plan : décision D16 ; design.md mis à jour.
- Points ouverts : spec F4 à adapter au dialogue ; token `--color-backdrop` ; SVG pochoir sans dimensions physiques ; morceau pdf-lib nommé `es-*.js`.

## 2026-11-08 — F4 Exports : spec adapté au dialogue
- Test : spec `e2e/f4-acceptance.spec.ts` adapté au dialogue « Exporter » (45 tests, verts deux fois sur HEAD) ; B1 (focus) confirmé corrigé et devenu test normal ; PNG 1024 et 4096 vérifiés. Aucun nouveau bug.

## 2026-11-08 — T15 Sélecteur de thème et finition
- Rôle : design
- Fait : sélecteur à trois états (D17), persistance bornée, `theme-init.js` sans flash, metas `color-scheme`/`theme-color`, composant commun `CompactChoice` (langue + thème), `--color-backdrop`.
- Vérifications : lint, typecheck, 841/841 tests verts (revérifié) ; build ; e2e 123/123 (f4 exclu) ; 42 captures (7 écrans × 3 largeurs × 2 thèmes) ; contrastes AA mesurés dans le navigateur, 0 échec ; pochoir noir sur blanc en thème or.
- Écarts au plan : trois états au lieu de ☾/☀ (D17, design.md mis à jour).
- Points ouverts : f4-acceptance non rejoué avec le nouvel arrêt clavier de l'en-tête (à couvrir au test F6/F7).

## 2026-11-08 — F5 Pochoir et PDF : test
- Verdict : VALIDÉ (passage n° 1, commit bfd7017 en worktree)
- Preuves : pochoir noir pur sans cercle ni fond (kamea, Spare, deux thèmes) ; PDF relu avec PyMuPDF : A4 exact, règle 10,000 mm, encre 60,000 mm à 6 cm (raster 1200 dpi : 59,99–60,01), 1 / 8 / 19 / 25 cm exacts, épaisseurs 0,3–1,2 mm exactes ; métadonnées « Sigil » + dates seulement, ni outil ni intention ; consigne FR/EN ; sigil trop large refusé avec taille max ; PNG 4096 pochoir sans pixel coloré ; export PDF hors ligne ; CSP, clavier, 375 px OK ; contrôle de mutation (9/25 tests échouent).
- Bugs : B1 valeur négative → message de format au lieu de la plage (mineur, renvoyé à dev) ; B2 texte FR du PDF non extractible avec accents (Helvetica standard sans ToUnicode, rendu correct) — observation.
- Tests e2e : `e2e/f5-acceptance.spec.ts` (25 tests), commit après la correction de B1.
- Non testé : impression papier et lecteurs PDF grand public.

## 2026-11-08 — F5 suites
- B1 corrigé (taille négative ou nulle → message de plage, FR/EN), test unitaire ; specs f5 + stencil 32/32.
- B2 consigné en limite connue : correctif possible sans dépendance (table ToUnicode WinAnsi dans `pdf.ts`, ~30 lignes) — à arbitrer en phase 5.

## 2026-11-08 — F6 Thèmes et FR/EN : test
- Verdict : VALIDÉ (passage n° 1, commit 8bced35 en worktree)
- Preuves : 12 combinaisons de langues navigateur ; choix langue/thème conservés, stockage limité à `sigil.language` et `sigil.theme` ; contraste AA mesuré sur 8 écrans × 2 thèmes × 2 langues, 0 échec (pire 5,88:1) ; aucun flash de thème (bundle retardé 1,2 s) ; mode Système en direct ; décimales et pluriels selon la langue ; PDF EN/FR ; aucune chaîne française en EN ; CSP, clavier, 375 px OK.
- Bugs mineurs renvoyés à dev : B1 « a 8 cm print » ; B2 texte de simplification contradictoire quand le nombre de segments augmente ; B3 tournures anglaises lourdes.
- Observations : titre et meta description non localisés ; test clavier F4 instable sous charge (4 workers).
- Tests e2e : `e2e/f6-acceptance.spec.ts` (55 tests), commit après correction.
