---
title: Limites et choix
description: Ce que Sigil ne fait pas, à dessein, et ce qu'il faut savoir avant d'utiliser un sigil, surtout un sigil kamea.
---

## Un sigil kamea peut être relu

La méthode kamea est une règle publique. Quelqu'un qui la connaît, et qui reconnaît le
carré, peut lire les numéros des cases sur le chemin et remonter jusqu'aux lettres. Sur les
carrés de 36 cases et plus (Soleil, Vénus, Mercure, Lune), chaque nombre correspond à une
lettre ; sur les carrés plus petits, plusieurs lettres partagent un nombre, ce qui ne fait
que restreindre les possibilités.

Un sigil de Spare est bien moins réversible : doublons et voyelles ont disparu, et les
lettres sont mises en miroir, doublées et fondues en une rune.

L'app le dit dans la boîte d'export d'un sigil kamea et dans sa note de confidentialité. Si
le mot doit rester privé, préférez la méthode de Spare.

## Un mot, des lettres latines

- L'intention est **un seul mot** de **24 lettres** au plus : au-delà d'un mot, ou de cette
  longueur, le sigil devient illisible.
- Seules les lettres **A à Z** sont tracées. Les lettres accentuées sont ramenées à leur
  lettre de base ; les autres écritures, les chiffres et les symboles sont ignorés.

## Choix des méthodes

- **Kamea** : la règle lettre → nombre est le rang alphabétique qui fait le tour du carré,
  A = 1 … Z = 26, pour les sept carrés. D'autres conversions (réduction pythagoricienne sur
  tous les carrés, gématrie hébraïque) ne sont pas proposées.
- **Kamea** garde chaque lettre, répétitions comprises : le chemin suit le mot tel qu'il
  est écrit.
- **Spare** retire toujours les doublons, retire les voyelles par défaut, et garde le Y.
- **Spare** compose une rune liée en traits droits. Il ne reproduit pas une superposition
  libre de lettres dessinées à la main.

## Ce qui n'a pas été vérifié

- L'app est testée dans Chromium. Les autres navigateurs n'ont pas été testés.
- La taille réelle du PDF est vérifiée par des tests automatisés sur le fichier ;
  l'impression dépend de l'imprimante et de ses réglages. Vérifiez toujours la règle de
  1 cm sur le papier (voir [Exporter](/sigil/docs/fr/guide/export/)).
