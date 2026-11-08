# Review — Sigil
Statut : validé le 2026-11-08
Périmètre : tout le dépôt versionné hors `docs/` au commit a444eaf — `src/` (app, components/ui, features/*, lib, styles), `scripts/`, `public/`, `index.html`, `vite.config.ts`, configs (eslint, tsconfig, playwright), `package.json` et lockfile, `.github/workflows/deploy.yml`, `e2e/`, README, NOTICE, LICENSE ; plus le build `dist/`.

## Verdicts
- Review code : GO après correction de R1 (relecture du 2026-11-08)
- Sécurité : GO (aucun bloquant)

## Bloquants
| ID | Constat | Où | Rôle | Allers-retours | État |
|---|---|---|---|---|---|
| R1 + S3 | Mentions de licence absentes du site déployé : attribution Hershey supprimée par le minifieur (condition de la licence), NOTICE/LICENSE et avis des dépendances non servis ; LICENSE laisse croire que Hershey est sous MIT | `hersheyConversion.ts`, `hersheyRomanSimplex.ts`, `vite.config.ts`, `LICENSE`, `README.md` | dev | 1 | corrigé (5ec499e), GO à la relecture |

## À corriger avant livraison
| ID | Constat | Où | Décision (corriger / reporter / recommander) |
|---|---|---|---|
| S1 | Un sigil kamea est réversible (qui connaît la méthode relit les lettres) ; rien ne le dit à l'utilisateur | dialogue d'export, README, D8 | corriger (Enzo, 2026-11-08) |
| S2 | Workflow : le job `build` hérite de `pages: write` et `id-token: write` ; checkout garde le jeton | `.github/workflows/deploy.yml:16-31` | corriger (Enzo, 2026-11-08) |
| R2 | Le panneau Spare promet « sans lettre isolée », critère qui n'existe plus depuis D13 ; ~150 lignes de calculs morts (isolement, lettre droite) | `strings.*.ts`, `buildSpareSigil.ts`, `score.ts`, `placement.ts`, `spare/geometry.ts`, `sigil/types.ts` | corriger (Enzo, 2026-11-08) |
| R3 | Commentaires faux après les reprises (épaisseur max 4 au lieu de 2,4, échelle 0,55 au lieu de 0,7, temps de calcul, tolérances) ; tests de non-contact kamea sans la vraie borne 2,4 | `buildKameaSigil.ts`, `style.ts`, `types.ts`, `simplify.ts`, `generateSpareCandidates.ts`, tests | corriger (Enzo, 2026-11-08) |
| R4 | Constantes en double ou mortes (tokens `--sigil-stroke-*` non lus, `MITER_LIMIT` du PDF recopié, marge de grille en dur, couleurs du manifest hors test anti-dérive, durées en dur dans un e2e) | `tokens.css`, `pdf.ts`, `kameaSteps.ts`, `vite.config.ts`, `e2e/style.spec.ts` | corriger (Enzo, 2026-11-08) |
| R5 | E2e fragiles (~25 `waitForTimeout`) et redondants (paires de specs qui se recouvrent, 4 conventions de captures) | `e2e/` | corriger les attentes fixes ; fusion des specs reportée (Plus tard) |

## Recommandé
| ID | Constat | Décision |
|---|---|---|
| S4 | Origine `<compte>.github.io` partagée avec les autres sites Pages du compte (stockage, caches, `'self'`) ; domaine dédié conseillé | rester sur github.io ; règle : aucun autre site Pages avec code tiers sur ce compte ; domaine dédié recommandé plus tard (Enzo, 2026-11-08) |
| S5 | CI : actions figées par tag et non par SHA, `npm ci` avec scripts, pas de Dependabot | corriger |
| S6 + R10 | E2e de confidentialité/CSP non lancés en CI ; README incomplet (`format:check`, régénération des glyphes, NOTICE) | corriger (e2e de confidentialité en CI, scripts) ; README en phase 6 |
| S7 | Trusted Types dans la CSP | reporter (Plus tard) |
| S8 | `translate="no"` sur le champ et les lettres affichées (traduction du navigateur) | corriger |
| S9 | Note de confidentialité et mentions (aucune donnée collectée, hébergeur GitHub, limite S1) ; mentions légales d'éditeur | corriger (note dans l'app) ; README en phase 6 ; mentions légales d'éditeur : à recommander |
| S10 | Empreinte SHA-256 du fichier Hershey vérifiée par le script de génération | corriger |
| R6–R9, R11 | Duplications (marques SVG ×3, boîtes englobantes ×5, stockage tolérant ×2), dépendance méthode → rendu, code sans usage, nommage | R7, R9, R11 corriger ; R6, R8 reporter (Plus tard) |
| R12 | `SigilScreen` à 13 états ; meta description statique en anglais | reporter (Plus tard) |
| R13 | Licences OFL des polices non publiées sur le site (NOTICE et LICENSE pointent vers des chemins du dépôt) ; version Workbox annoncée inexacte (7.4.1 au lieu de 7.4.0) | corriger (T21) |
| B2 (F5) | Texte du PDF non extractible avec accents (correctif sans dépendance, ~30 lignes) | corriger |

## Hors code
- Informations personnelles retirées de `docs/` avant publication.

## Correctifs appliqués
- R1 + S3 : 5ec499e (GO à la relecture) ; R13 : a8d869f.
- S1, S8, S9, B2, R4 (PDF) : 9959a1b (T20).
- S2, S5, S6, S10, R5 (attentes fixes), R4 (anti-dérive, durées), R10 (scripts) : a8d869f (T21).
- R2, R3, R4 (tokens, grille), R7, R9, R11 : 34a6b64 (T22), empreinte de rendu identique avant/après.
- Reportés en « Plus tard » (roadmap) : fusion des specs e2e (R5), S7, R6, R8, R12, S4 (domaine dédié).

## Évolution après review (décision d'Enzo)
- Un seul mot (D18), Spare en rune liée (D19–D21) : T23, T24, T25 ; planche validée par Enzo ; F2 revalidé (passage n° 4) ; correctif des contacts 0ca5e81.

## Vérifié au pilotage
- Sur 0ca5e81 : lint, format:check, typecheck ; 989/989 unitaires ; 5/5 script ; build ; e2e 283/283.
- Après correctifs (34a6b64) : lint, format:check, typecheck verts ; 878/878 tests unitaires ; 5/5 tests du script ; build (28 entrées précachées) ; e2e 269/269.
- `npm audit --omit=dev` : 0 vulnérabilité (2026-11-08).

## Non vérifié
- Réglages du dépôt GitHub (protection de branche, environnement `github-pages`, HTTPS forcé), autres sites Pages du compte.
- Navigateurs autres que Chromium ; impression papier réelle ; lecteurs PDF grand public ; performance sur téléphone.
