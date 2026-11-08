---
title: Confidentialité
description: Ce qui reste dans le navigateur, les deux préférences enregistrées sur l'appareil, et ce que voit l'hébergeur.
---

Une intention peut être intime. Sigil est conçu pour qu'elle ne quitte jamais le
navigateur.

## Ce que devient le mot que vous tapez

Tout se passe dans le navigateur. L'intention n'est **jamais envoyée** nulle part ni
**jamais enregistrée** :

- ni dans l'adresse de la page : le formulaire n'est jamais envoyé ;
- ni sur l'appareil : elle ne vit que dans la mémoire de la page, et disparaît à sa
  fermeture ;
- ni dans les fichiers exportés : leur nom ne dit que la méthode et la date, et les
  métadonnées du PDF que « Sigil » et la date.

Le champ de l'intention et les lettres du panneau « Comment c'est fait » sont marqués pour
que la traduction de page du navigateur ne les touche pas.

## Ce qui est enregistré sur l'appareil

Seulement deux préférences, dans le stockage local du navigateur, et seulement quand vous
les choisissez :

| Clé | Valeurs | Écrite quand |
|---|---|---|
| `sigil.language` | `fr` ou `en` | vous choisissez une langue avec **FR \| EN** |
| `sigil.theme` | `light` ou `dark` | vous choisissez **Encre sur papier** ou **Or sur noir** ; effacée quand vous revenez à **Système** |

Un visiteur qui ne touche jamais à ces sélecteurs laisse le stockage vide. La copie hors
ligne de l'app (voir [Hors ligne et installation](/sigil/docs/fr/guide/offline/)) ne
contient que les fichiers de l'app.

## Aucun tiers

- Ni cookie, ni mesure d'audience, ni police ou script venant d'un autre site : les polices
  sont servies par le site lui-même.
- Une politique de sécurité du contenu (CSP) limite la page à sa propre origine : aucune
  requête ne peut partir vers un autre site, et aucun formulaire ne peut être envoyé.
- La page ne dit jamais à un autre site de quelle page vient un visiteur (pas de
  référent).

## L'hébergeur

Le site est hébergé par **GitHub Pages**, qui journalise les adresses IP des visiteurs
selon sa propre politique de confidentialité. Le site lui-même ne transmet rien.

Cette documentation suit les mêmes règles : pages statiques, index de recherche intégré au
site, aucune mesure d'audience.

## Un sigil kamea peut être relu

La confidentialité dépend aussi de la méthode : quelqu'un qui connaît la méthode kamea peut
relire les lettres d'un sigil kamea. Voir [Limites](/sigil/docs/fr/methods/limits/).
