# Design — Sigil
Statut : proposé le 2026-11-07

## Direction
1. Une page de grimoire tenue par un graveur : beaucoup de vide, un seul objet au centre (le sigil), le reste est de l'annotation.
2. Le trait fait tout : fin, d'épaisseur constante, géométrique, comme une aiguille fine line ; aucun dégradé, aucune lueur, aucune texture.
3. Deux voix typographiques : un garalde pour l'intention et les titres (le grimoire), un monospace pour les chiffres, lettres et réglages (la construction).
4. Ésotérique par la retenue : cercle, carré, chiffres, rouge de rubrique ou or plat. Pas de pentagramme décoratif, pas de police gothique, pas de parchemin photographique.
5. Le pochoir sort de l'esthétique : noir pur sur blanc pur, trait unique, rien d'autre.

### Ce qu'on reprend, ce qu'on écarte
| Inspiration | Repris | Écarté |
|---|---|---|
| Tatouage fine line | Trait mince et constant, extrémités rondes, géométrie nette, beaucoup d'air autour du motif | Ombrages, pointillés, ornements floraux |
| Sceaux de grimoires (Clavicule, Goétie) | Cercle d'encadrement, marques de départ et d'arrivée, rouge de rubrique comme unique accent du thème clair, chiffres alignés en grille | Double cercle chargé d'inscriptions, alphabets magiques, glyphes et noms d'entités réels |
| Austin Osman Spare | Glyphe compact, lettres fusionnées jusqu'à l'illisibilité, équilibre autour d'un centre | Dessin à la main tremblé, figures, hachures |

## Couleurs
Tokens sémantiques dans `src/styles/tokens.css`, thème clair par défaut, sombre via `data-theme="dark"` (ou `prefers-color-scheme` si l'utilisateur n'a rien choisi).

### Encre sur papier (clair)
| Rôle | Token | Hex |
|---|---|---|
| Fond de page | `--color-bg` | `#F3EEE3` |
| Surface (panneaux, scène) | `--color-surface` | `#FAF7F0` |
| Surface en creux (grille kamea, code) | `--color-surface-sunken` | `#E9E2D3` |
| Texte | `--color-text` | `#1C1914` |
| Texte secondaire | `--color-text-muted` | `#5B5345` |
| Bordure de champ | `--color-border` | `#847966` |
| Filet décoratif | `--color-border-subtle` | `#D6CDBB` |
| Accent (rouge de rubrique) | `--color-accent` | `#8E2A1D` |
| Accent survol | `--color-accent-hover` | `#6E1F15` |
| Trait du sigil | `--sigil-stroke` | `#1C1914` |

### Or sur noir (sombre)
| Rôle | Token | Hex |
|---|---|---|
| Fond de page | `--color-bg` | `#0F0E0C` |
| Surface | `--color-surface` | `#1A1814` |
| Surface en creux | `--color-surface-sunken` | `#090807` |
| Texte (os) | `--color-text` | `#ECE5D5` |
| Texte secondaire | `--color-text-muted` | `#A89E8A` |
| Bordure de champ | `--color-border` | `#71684F` |
| Filet décoratif | `--color-border-subtle` | `#2E2A22` |
| Accent (or plat) | `--color-accent` | `#D2AE5C` |
| Accent survol | `--color-accent-hover` | `#E4C47E` |
| Trait du sigil | `--sigil-stroke` | `#D2AE5C` |

Sémantiques (texte + icône, jamais la couleur seule) — clair / sombre : succès `#2F6B3A` / `#7FBF8A`, alerte `#8A5A00` / `#E0B04F`, erreur `#A12A1E` / `#E58A7A`, info `#2C5A7A` / `#86B7D9`.

### Contrastes vérifiés (WCAG 2.x)
| Couple | Clair | Sombre | Seuil |
|---|---|---|---|
| Texte / fond | 15,14 | 15,38 | 4,5 |
| Texte / surface | 16,38 | 14,13 | 4,5 |
| Texte / surface en creux | 13,59 | 15,95 | 4,5 |
| Texte secondaire / fond | 6,56 | 7,28 | 4,5 |
| Texte secondaire / surface | 7,09 | 6,69 | 4,5 |
| Accent / fond (liens, focus) | 7,26 | 9,14 | 4,5 |
| Accent / surface | 7,85 | 8,40 | 4,5 |
| Texte sur bouton accent | 7,85 | 9,14 | 4,5 |
| Texte sur bouton accent survolé | 10,50 | 11,48 | 4,5 |
| Bordure de champ / surface | 4,00 | 3,20 | 3 |
| Bordure de champ / fond | 3,70 | 3,49 | 3 |
| Trait du sigil / surface | 16,38 | 8,40 | 3 |
| Chiffres de la grille / surface en creux | 4,66 | 5,55 | 4,5 |
| Texte / case active kamea | 12,22 | 11,36 | 4,5 |
| Succès / surface | 5,97 | 8,21 | 4,5 |
| Alerte / surface | 5,54 | 8,86 | 4,5 |
| Erreur / surface | 6,85 | 6,96 | 4,5 |
| Info / surface | 6,89 | 8,26 | 4,5 |
| Pochoir noir / blanc | 21,00 | 21,00 | — |

Exemptés et assumés : filets décoratifs (`--color-border-subtle`, ~1,4) et lignes de la grille kamea (~1,5), qui ne portent aucune information (les chiffres délimitent les cases) ; textes désactivés (exemptés par WCAG). La bordure de champ n'est jamais posée sur la surface en creux du thème clair sans vérifier (3,32).

## Typographie
Deux familles, licence SIL Open Font License 1.1, fichiers `woff2` sous-ensemble latin + latin étendu servis depuis le dépôt (`src/assets/fonts/`, déclarés dans `src/styles/fonts.css`), `font-display: swap`. Les fichiers de licence `OFL.txt` sont copiés à côté des polices.

| Famille | Usage | Graisses | Repli |
|---|---|---|---|
| **EB Garamond** (OFL 1.1) | Titre, intention saisie, textes du panneau explicatif | 400, 500, 400 italique | `Georgia, "Times New Roman", serif` |
| **IBM Plex Mono** (OFL 1.1) | Libellés, boutons, chiffres, lettres retirées, grille kamea, valeurs de réglage | 400, 500 | `ui-monospace, "SFMono-Regular", Consolas, monospace` |

Échelle : 12, 14, 16, 18, 20, 24, 30, 36, 48.
- Corps (Garamond) 18 px / 1,55 — le Garamond paraît plus petit qu'une sans ; jamais sous 16 px.
- Libellés et boutons (Plex Mono) 14 px, capitales, interlettrage 0,08 em ; valeurs et chiffres 14–16 px, `tabular-nums`.
- Intention saisie : Garamond 24 px (20 px à 375).
- Titre « Sigil » : Garamond 500, 30 px (24 px à 375), interlettrage 0,04 em.
- Titres de section : Plex Mono 12 px capitales, couleur secondaire — l'annotation, pas le titre, guide l'œil.
- Lecture limitée à 65 caractères (`--measure`).

## Espacements, rayons, ombres
- Espacement base 4 : 4, 8, 12, 16, 24, 32, 48, 64 (`--space-1` à `--space-8`).
- Rayons : 2 px (champs, boutons), 4 px (panneaux, dialogue), plein (pastilles, interrupteur). Angles quasi vifs : la géométrie vient du sigil, pas des boîtes.
- Ombres : un seul niveau réel (dialogue d'export, menu). Les panneaux se séparent par filet et espacement. En sombre, l'ombre est remplacée par une bordure subtile.
- Points de rupture : 640, 768, 1024, 1280. Cibles tactiles ≥ 44 px.

## Trait du sigil
Repère SVG `viewBox="0 0 1000 1000"`, motif inscrit dans un carré de 800 centré (marge de 100 pour le cadre et les marques).

| Réglage | Défaut | Plage | Remarque |
|---|---|---|---|
| Épaisseur (unités du repère) | 12 | 4 – 40, pas de 2 | Soit 1,2 % de la taille ; curseur affiché en « fin / moyen / épais » + valeur |
| Extrémités arrondies | oui | oui / non | oui : `stroke-linecap="round"` + `stroke-linejoin="round"` ; non : `butt` + `miter`, `stroke-miterlimit="4"` |
| Cercle d'encadrement | non | oui / non | Rayon 460, même épaisseur que le trait, tracé en dernier |

Marques kamea (proportionnelles au trait `s`) : cercle de départ, rayon 2,5 `s`, non rempli ; trait d'arrivée perpendiculaire, longueur 8 `s` ; boucle d'une lettre répétée, rayon 3 `s`. Grille kamea affichée derrière le tracé dans l'app (filets fins, chiffres en Plex Mono), jamais exportée sauf option explicite.

**Pochoir** : `#000000` sur `#FFFFFF` quel que soit le thème, épaisseur fixée en millimètres réels (défaut 0,6 mm, plage 0,3 – 1,2 mm) puis convertie en unités du repère selon la taille d'impression : `s = mm × 1000 / taille_mm`. Pas de grille, pas de couleur, marques en contour.

Les exports SVG portent des couleurs littérales (thème courant ou pochoir), jamais des `var(--…)`, pour s'ouvrir hors de l'app.

## Mise en page

### Desktop (≥ 1280 px)
```
┌──────────────────────────────────────────────────────────────────────┐
│ SIGIL                                           FR|EN   ☾/☀          │ en-tête 64 px, filet bas
├────────────────┬──────────────────────────────┬──────────────────────┤
│ INTENTION      │                              │ COMMENT C'EST FAIT   │
│ [___________]  │                              │ 1. Texte normalisé   │
│ MÉTHODE        │        scène du sigil        │ 2. Lettres retirées  │
│ (Spare|Kamea)  │      carrée, max 640 px      │ 3. Nombres / squel.  │
│ Planète ▾      │                              │ 4. Chemin (grille)   │
│ [ TRACER ]     │                              │                      │
│ ───────        ├──────────────────────────────┤                      │
│ STYLE          │ Rejouer · Autre variante ·   │                      │
│ épaisseur ─○─  │ Exporter ▾                   │                      │
│ ☐ arrondi ☐ ○  │                              │                      │
└────────────────┴──────────────────────────────┴──────────────────────┘
  320 px            flexible                       360 px
```
- Colonnes 320 / 1fr / 360, gouttière 32, marge latérale 48. La scène est le seul élément sur fond `surface` ; les colonnes latérales restent sur le fond de page.
- 1024 – 1279 : deux colonnes (320 / 1fr), le panneau explicatif passe sous la scène, en deux colonnes internes (étapes | grille).
- 768 – 1023 : une colonne centrée (max 640), saisie et méthode côte à côte au-dessus de la scène.

### Mobile (375 px)
Une colonne, marge 16, ordre de lecture = ordre d'usage :
1. En-tête 56 px : « Sigil », langue, thème.
2. Intention (pleine largeur) puis méthode (contrôle segmenté) et planète (si kamea).
3. Bouton « Tracer » pleine largeur.
4. Scène carrée pleine largeur (343 px).
5. Barre d'actions : Rejouer, Autre variante (icône + texte), Exporter — 3 boutons de 44 px, sans défilement horizontal.
6. « Style » et « Comment c'est fait » en sections repliables (`details`/`summary`), « Comment c'est fait » ouverte par défaut après le premier tracé.

### Export
Dialogue modal (plein écran sous 640 px) : format (SVG, PNG, PDF), pour PNG la résolution (1024 / 2048 / 4096), pour PDF la taille en cm (défaut 8 cm, 2 – 30) et l'interrupteur « Pochoir tatouage » avec l'épaisseur en mm ; aperçu miniature du rendu exporté ; bouton « Télécharger ».

## Composants à construire
Tous ont repos, survol, focus visible (anneau 2 px `--color-focus`, décalage 2 px), actif, désactivé ; chargement quand une action peut durer.

| Composant | Rôle | États spécifiques |
|---|---|---|
| `Button` | Variantes `primary` (fond accent), `secondary` (contour), `ghost` (texte), `icon` | chargement (export PDF) : libellé conservé, indicateur à droite, `aria-busy` |
| `TextField` | Intention : label visible, aide, compteur, erreur sous le champ | erreur annoncée (`aria-describedby`, région `polite`) : « Aucune lettre latine à tracer » |
| `SegmentedControl` | Méthode Spare / Kamea (radios natifs stylés) | sélectionné : fond accent, texte `on-accent` |
| `PlanetPicker` | 7 carrés : nom + taille (« Saturne · 3×3 ») en radios | sélectionné : bordure accent + coche |
| `Slider` | Épaisseur du trait (`input type="range"`) | valeur affichée en Plex Mono |
| `Switch` | Arrondi, cercle, voyelles conservées, pochoir | `role="switch"`, texte d'état à côté |
| `SigilStage` | Scène SVG, `role="img"` + `aria-label` décrivant méthode et intention masquée | vide (cercle en filet + invitation), tracé en cours, tracé, erreur |
| `KameaGrid` | Grille N×N, chiffres, case active pendant le tracé | case active : `--color-cell-active` |
| `StepList` | Étapes du panneau explicatif, synchronisées avec le tracé | étape courante soulignée d'un filet accent |
| `LetterStrip` | Lettres de l'intention, retirées barrées et atténuées | retiré = barré + texte « retirée » pour lecteurs d'écran |
| `Disclosure` | Sections repliables mobile | ouvert / fermé, chevron |
| `Dialog` | Export | focus piégé, retour du focus au déclencheur, `Échap` ferme |
| `StatusMessage` | Retour d'export, caractères ignorés | succès / alerte / erreur, icône + texte, région `aria-live` |
| `ThemeToggle`, `LanguageToggle` | En-tête | état lisible en texte (« Thème : or sur noir ») |

## Animation du tracé
- Technique : chaque chemin reçoit `pathLength="1"`, animation de `stroke-dashoffset` de 1 à 0 (CSS ou Web Animations API), sans dépendance.
- Durée totale `--duration-trace` 2 400 ms, répartie entre les chemins au prorata de leur longueur ; chaque trait de Spare est tracé à vitesse constante (linéaire), avec une levée de plume de 80 ms entre deux traits. Le chemin kamea, unique, suit `--ease-trace` (`cubic-bezier(0.45, 0, 0.25, 1)`) : départ posé, fin ralentie.
- Ordre : marque de départ (fondu 150 ms), chemin, marque d'arrivée, puis cercle d'encadrement (600 ms).
- Le panneau explicatif suit le tracé : la case kamea et l'étape en cours s'allument au passage.
- « Rejouer » relance ; changer un réglage de style ne relance pas le tracé (mise à jour immédiate).
- `prefers-reduced-motion: reduce` : aucun tracé, sigil final affiché avec un fondu de 150 ms, grille et étapes montrées dans leur état final ; « Rejouer » reste disponible et rejoue en pas à pas statique (une étape par clic).
- Interactions d'interface : 120 ms (survol), 200 ms (ouverture de section), `--ease-standard`.

## Points de goût à trancher
1. **Thème au premier chargement** — suivre le système ou imposer « or sur noir ». *Recommandation :* suivre le système ; l'or sur noir sert le GIF du README et la capture vitrine, l'encre sur papier sert le pochoir.
2. **Police d'interface** — IBM Plex Mono (construction, chiffres alignés, ton « carnet de calcul ») ou Jost (géométrique fine, plus « tatouage », moins technique). *Recommandation :* Plex Mono, qui rend lisible la pédagogie (nombres, cases, lettres).
3. **Accent du thème clair** — rouge de rubrique `#8E2A1D` ou encre seule (noir, accent porté par le soulignement). *Recommandation :* rouge de rubrique, discret et historiquement juste ; il ne touche jamais le sigil.
4. **Grain de papier** — fond uni ou très léger grain SVG (bruit 2 %) sur le thème clair. *Recommandation :* uni ; le grain glisse vite vers le décor de jeu de rôle et alourdit les captures.
