---
title: La méthode kamea
description: Comment un mot devient un chemin sur l'un des sept carrés magiques planétaires d'Agrippa, avec ses marques de départ, d'arrivée et de boucle.
---

Un **kamea** est un **carré magique** planétaire : une grille de N × N cases contenant les
nombres 1 à N², où chaque ligne, chaque colonne et chaque diagonale a la même somme. La
méthode change chaque lettre du mot en nombre, puis relie d'un seul trait les cases
correspondantes du carré.

## Les sept carrés

Sigil utilise les sept carrés d'Agrippa (*De occulta philosophia*, 1533, livre II,
chapitre 22), dans leur disposition traditionnelle. Les tests unitaires vérifient chaque
somme de ligne, de colonne et de diagonale, et que chaque carré contient 1 à N² une seule
fois.

| Planète | Taille | Cases |
|---|---|---|
| Saturne | 3×3 | 9 |
| Jupiter | 4×4 | 16 |
| Mars | 5×5 | 25 |
| Soleil | 6×6 | 36 |
| Vénus | 7×7 | 49 |
| Mercure | 8×8 | 64 |
| Lune | 9×9 | 81 |

Le carré de Saturne, par exemple :

```
4  9  2
3  5  7
8  1  6
```

## Des lettres aux nombres

1. Le mot est normalisé : accents retirés, majuscules, seules les lettres A à Z gardées.
   La méthode kamea garde **chaque** lettre, même répétée.
2. Chaque lettre prend son rang dans l'alphabet : A = 1, B = 2 … Z = 26.
3. Le rang fait le tour des N² cases du carré choisi :

```
nombre = ((rang − 1) mod N²) + 1
```

Sur Saturne (9 cases), L (rang 12) donne ((12 − 1) mod 9) + 1 = 3. Sur Saturne, cette
règle est la réduction pythagoricienne. À partir du Soleil (36 cases et plus), chaque
lettre garde son rang ; sur Mars (25 cases), seul le Z repart à 1.

**Exemple** : « Calme » sur Saturne donne C = 3, A = 1, L = 12 → 3, M = 13 → 4, E = 5 : le
chemin relie les cases **3, 1, 3, 4, 5**.

## Le chemin et ses marques

Le trait passe par le centre des cases, dans l'ordre des lettres. Trois marques le rendent
lisible :

- un **cercle de départ** sur la première case ;
- un **trait d'arrivée** en travers de la dernière case, perpendiculaire au dernier
  segment ;
- une **boucle** sur une case atteinte plusieurs fois de suite : la même lettre deux fois
  (« ll »), ou deux lettres différentes qui tombent sur la même case (sur Saturne, A et J
  donnent toutes deux 1).

Une case ne reçoit qu'une boucle, même quand plusieurs passages séparés y tombent : le
chemin montre déjà combien de fois elle est visitée, et des boucles empilées se fondraient
en une tache sur les petites cases de la Lune. Une boucle sur la dernière case se place à
côté du dernier segment, à l'écart du trait d'arrivée.

Les marques sont dimensionnées d'après les cases du carré, pour rester dans leur case du
3×3 au 9×9, et elles suivent l'épaisseur du trait jusqu'à un plafond.

## Déterminisme

La méthode ne tire rien au hasard : le même mot sur le même carré donne toujours le même
sigil.

## Quand un mot ne peut pas être tracé

- **Une seule lettre** ne trace aucun chemin : écrivez au moins deux lettres.
- **Toutes les lettres sur la même case** (par exemple « AJ » sur Saturne) traceraient un
  simple point : choisissez un autre carré ou ajoutez des lettres.

## Le voir dans l'app

Le panneau « Comment c'est fait » montre la règle du carré choisi avec un exemple, la table
lettre → nombre, et le carré avec le chemin tracé par-dessus.

Voir aussi [Limites](/sigil/docs/fr/methods/limits/) : un sigil kamea peut être relu par
quelqu'un qui connaît la méthode.
