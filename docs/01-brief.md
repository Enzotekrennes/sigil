# Brief — Enzo / Sigil
Statut : validé le 2026-11-07

## Client
- Structure, secteur, taille : projet personnel d'Enzo, vitrine pour son GitHub public.
- Interlocuteur : Enzo.

## Problème
Les générateurs de sigils en ligne sont rares, peu soignés et se contentent d'empiler des
lettres. Les méthodes traditionnelles (Spare, kamea) sont précises et algorithmisables,
mais aucun outil ne les applique proprement en montrant comment le sigil est construit.

## Objectif
- Vitrine : démontrer l'art génératif, le SVG et le soin du design (README avec GIF de tracé,
  exemples, lien vers la démo).
- Usage perso : produire des motifs de tatouage exploitables par un tatoueur (PDF à taille réelle).
- Pédagogie : chaque sigil affiche les étapes qui l'ont produit.
- Critère mesurable : même intention + même méthode + mêmes réglages → sigil identique
  (déterministe) ; parcours complet intention → export en moins d'une minute.

## Utilisateurs
- Enzo (usage perso, tatouages).
- Curieux d'ésotérisme et d'art génératif arrivant sur la démo publique.
- Tatoueurs destinataires d'un fichier exporté (ne manipulent pas l'outil).

## Existant
- Outils en place : aucun (projet neuf).
- Données et où elles vivent : aucune persistance ; tout est calculé dans le navigateur.

## Données personnelles
Aucune collectée. L'intention saisie peut être intime : elle ne quitte jamais le navigateur
(pas de serveur, pas de mesure d'audience, rien dans l'URL).

## Méthodes (connaissances métier)
- **Spare** : affirmation au présent → suppression des lettres en double (et souvent des
  voyelles) → fusion des lettres restantes en un glyphe (superposition, rotation, symétrie)
  jusqu'à illisibilité. Piste : squelettes de lettres à trait unique (polices Hershey),
  placement pour partager des traits, transformations, simplification, recherche d'équilibre
  (centre de gravité, encombrement). Graine dérivée de l'intention + bouton « autre variante ».
- **Kamea** : 7 carrés planétaires d'Agrippa (Saturne 3×3 … Lune 9×9). Lettre → nombre,
  tracé reliant les cases dans l'ordre, cercle au départ, trait perpendiculaire à l'arrivée,
  boucle pour une lettre répétée deux fois de suite.
  Conversion retenue (tous carrés) : rang alphabétique A=1 … Z=26, retour au début au-delà
  de N×N, soit ((rang − 1) mod N²) + 1. Pour Saturne, c'est la réduction pythagoricienne.
  La règle est affichée dans le panneau « comment c'est fait ».
  Plus tard : option « réduction pythagoricienne pour tous les carrés ».
- **Roue rose-croix** (Golden Dawn, hébreu) : plus tard.

## Inspirations et charte
- Images et URL de référence : aucune image pour l'instant. Références de style : sceaux des
  grimoires anciens (Clavicule de Salomon, Goétie) et dessins d'Austin Osman Spare.
- Charte existante : non.
- Ton visuel attendu : trait fin et géométrique, façon tatouage fine line ; ésotérique sans kitsch ; thèmes « encre sur papier » et
  « or sur noir » ; trait réglable, extrémités arrondies, cercle d'encadrement optionnel ;
  mode pochoir tatouage (trait unique, noir pur).

## Contraintes
- Budget (build et récurrent) : Hypothèse : 0 € récurrent (hébergement statique gratuit).
- Délai : V1 en ligne en 2 semaines maximum (à partir du 2026-11-07, donc au plus tard le
  2026-11-21).
- Hébergement / RGPD : GitHub Pages sur <compte>.github.io/sigil, PWA installable qui marche
  hors ligne, aucune donnée transmise. Dépôt GitHub créé en privé en phase 6, rendu public
  par Enzo quand le README et la démo sont prêts.
- Autonomie attendue après livraison : Enzo maintient seul ; code commenté en anglais,
  documentation en site bilingue EN/FR, aucune trace d'outillage dans le code ni les commits.
- Licence du projet : MIT. Licence des polices à trait unique à vérifier.

## Hypothèses
- Décidé : TypeScript + React + Vite.
- Hypothèse : rendu 100 % SVG, sans canvas (PNG produit par rastérisation du SVG côté client).
- Hypothèse : les lettres accentuées sont normalisées (é → E) et les caractères non latins
  ignorés avec un message.
- Hypothèse : Spare retire les voyelles par défaut, avec une option pour les garder.
- Hypothèse : les polices Hershey sont utilisables (avis de libre usage avec attribution),
  à confirmer au plan.
- Hypothèse : PDF à taille réelle généré côté client, taille saisie en centimètres.

## Questions ouvertes
- Aucune.
