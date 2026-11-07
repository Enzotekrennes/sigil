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
