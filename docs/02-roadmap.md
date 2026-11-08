# Roadmap — Sigil
Statut : validé le 2026-11-07

Fenêtre : 2026-11-07 → 2026-11-21 (V1 en ligne). S1 = semaine du 2026-11-09, S2 = semaine du 2026-11-16.

## Jalons
| Jalon | Échéance | Livrable | Critère de réussite |
|---|---|---|---|
| J0 | 2026-11-09 | Brief, roadmap et plan technique validés | Les trois fichiers sont à `validé` |
| J1 | S1, 2026-11-10 | Socle : React + TS + Vite, PWA, workflow de déploiement GitHub Pages prêt (activé à J5), tokens de design | `build` et tests au vert ; l'app s'ouvre hors ligne après une première visite |
| J2 | S1, 2026-11-12 | Méthode kamea complète : 7 carrés, conversion affichée, tracé animé, marques départ / arrivée / boucle | Même intention → même SVG ; scénarios kamea validés par test d'acceptation |
| J3 | S1, 2026-11-15 | Méthode de Spare : squelettes à trait unique, composition équilibrée, graine, variantes, panneau explicatif | Même intention → même sigil ; « autre variante » donne un glyphe différent et stable |
| J4 | S2, 2026-11-18 | Style (trait, extrémités, cercle), thèmes encre / or, exports SVG et PNG ; pochoir + PDF taille réelle et FR/EN si le temps le permet | Exports ouverts sans défaut dans un navigateur et un éditeur vectoriel ; PDF mesuré à la bonne taille |
| J5 | S2, 2026-11-21 | Review + sécurité, README (GIF, exemples), site de documentation EN/FR, dépôt GitHub privé, démo en ligne | Verdicts GO ; démo accessible sur `<compte>.github.io/sigil` ; aucune trace d'outil dans le dépôt |

## To-do
### Indispensable
- [ ] Méthode de Spare : normalisation du texte, retrait des doublons (et des voyelles, option), fusion générative à partir de squelettes à trait unique, équilibre de composition
- [ ] Méthode kamea : 7 carrés d'Agrippa, conversion A=1…Z=26 modulo N², cercle de départ, trait d'arrivée, boucle sur lettre répétée
- [ ] Résultat déterministe (graine tirée de l'intention) et bouton « autre variante »
- [ ] Animation du tracé
- [ ] Panneau « comment c'est fait » : lettres retirées, nombres, règle de conversion, chemin sur le carré
- [ ] Exports SVG et PNG
- [ ] Site statique PWA, hors ligne, déployé sur GitHub Pages ; l'intention ne quitte jamais le navigateur
- [ ] Licence des polices à trait unique vérifiée et attribuée
- [ ] README vitrine (GIF du tracé, exemples, lien démo), licence MIT, site de documentation EN/FR

### Important
- [ ] Mode pochoir tatouage : trait unique noir pur, PDF à taille réelle en centimètres
- [ ] Thèmes visuels encre sur papier et or sur noir
- [ ] Interface bilingue FR/EN

### Plus tard
- [ ] Fusion des specs e2e en double et convention unique de captures (R5)
- [ ] Trusted Types dans la CSP (S7)
- [ ] Refactorings : rendu des marques partagé, stockage tolérant commun, `features/theme`, `SigilScreen` allégé (R6, R8, R12)
- [ ] Domaine dédié pour isoler l'origine (S4)
- [ ] Option « réduction pythagoricienne pour tous les carrés »
- [ ] Roue rose-croix (translittération hébraïque)
- [ ] Export pour traceur à stylo (pen plotter)
- [ ] Galerie locale de mes sigils

## Hors périmètre
- Comptes, base de données, réseau social, serveur, mesure d'audience, intention dans l'URL.

## Hypothèses fortes
- La composition générative de Spare est le principal risque de délai : J3 a la plus grosse marge, et le kamea passe avant pour avoir une démo montrable dès J2.
- Si J4 glisse, les « Important » (pochoir/PDF, thèmes, FR/EN) passent en V1.1 juste après la mise en ligne plutôt que de repousser J5.
- Le site de documentation EN/FR est livré en version minimale à J5 (guide d'usage + référence générée), enrichi ensuite.
