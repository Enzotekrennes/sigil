---
title: La méthode de Spare
description: Comment Sigil réduit un mot avec la méthode d'Austin Osman Spare et compose les lettres restantes en rune liée.
---

La méthode d'Austin Osman Spare retire des lettres de l'intention jusqu'à n'en garder que
quelques-unes, puis les fond en un seul glyphe qui ne se lit plus comme un mot. Sigil
compose ce glyphe en **rune liée** : des lettres anguleuses accrochées à une **hampe**
verticale, plus hautes que larges, souvent symétriques.

## 1. Réduction des lettres

Le mot est normalisé comme pour le kamea (accents retirés, majuscules, A à Z seulement),
puis :

1. chaque **lettre répétée** est retirée : la première occurrence reste, à sa place ;
2. puis les **voyelles** A, E, I, O, U sont retirées, sauf si **Garder les voyelles** est
   sur oui.

Le Y n'est pas retiré : il sert souvent de consonne, et le garder laisse une lettre de plus
aux mots courts. Une voyelle répétée compte comme doublon, puisque les doublons partent en
premier.

**Exemple** : « Tranquillité » donne les doublons L, I, T, les voyelles A, U, I, E, et
retient **T R N Q L**.

S'il ne reste rien (un mot fait seulement de voyelles, comme « oui »), l'app propose de
garder les voyelles.

## 2. Squelettes anguleux

Chaque lettre retenue part de son squelette à trait unique dans la police **Hershey Roman
Simplex** (capitales A à Z). Chaque courbe de ce squelette est redessinée en deux à quatre
segments droits, pour que la rune ne compte que des traits droits : le S devient un
zigzag, le O un losange, le C un crochet, et les panses de B, D, P et R des triangles.

## 3. Accroche sur la hampe

Un trait vertical, la **hampe**, traverse le sigil de haut en bas. Chaque lettre s'y
accroche de l'une de trois façons :

- **sur la hampe** : une lettre qui a un trait vertical le pose sur la hampe (B, D, E, F,
  H, I, J, K, L, M, N, P, R, T, U ; le Y s'en détache en fourche avec sa demi-hampe) ;
- **centrée** : la hampe la traverse en son milieu (un O devient un losange enfilé sur
  elle) ;
- **suspendue** : elle ne touche la hampe que par sa seule pointe extérieure (la pointe
  d'un C).

Les lettres s'accrochent l'une sous l'autre. Une lettre peut être mise **en miroir** de
gauche à droite, deux lettres peuvent partager une même hauteur de part et d'autre de la
hampe, et une lettre peut être **doublée** par son reflet de l'autre côté, ce qui rend la
rune symétrique. Deux lettres qui se suivent peuvent se chevaucher un peu sur la hampe, et
une longueur de hampe nue dépasse au-dessus et au-dessous des lettres.

## 4. Les variantes et leur style

Chaque variante a un **style** :

- **symétrique** : chaque lettre posée d'un seul côté de la hampe est doublée par son
  reflet ;
- **appariée** : aucune lettre n'est doublée, et les lettres d'un seul côté se font face de
  part et d'autre de la hampe ;
- **mixte** : certaines lettres sont doublées, d'autres restent d'un seul côté.

Les mots courts (jusqu'à quatre lettres retenues) passent par symétrique, appariée, puis
mixte ; les mots plus longs alternent mixte et appariée, car une rune symétrique
accrocherait une petite lettre par niveau le long d'une longue hampe.

La première variante accroche les lettres dans l'ordre du mot. Avec trois lettres ou
moins, les variantes suivantes passent tour à tour par tous les ordres possibles ;
au-delà, chaque variante mélange les lettres à sa façon.

## 5. Choix de la rune

Pour chaque variante, Sigil compose entre 24 et 64 runes candidates (moins pour les mots
longs, pour que chaque mot prenne à peu près le même temps), fait tenir chacune dans un
disque à l'intérieur du cadre, et donne à chacune une **pénalité** ; la plus basse
l'emporte. La pénalité compte :

| Ce qui est mesuré | Pénalité |
|---|---|
| Hachures : traits parallèles collés, qui se lisent comme un trait flou | 10 par hachure |
| Encre au-delà d'un plafond (6,5 fois le côté de la zone de dessin) | 0,5 par dixième du plafond dépassé |
| Une silhouette plus de 2,5 fois plus haute que large | 2 par unité de ratio en trop |
| Asymétrie, selon le style (symétrique / mixte / appariée) | jusqu'à 2 / 1 / 0,5 |
| Déséquilibre entre les deux côtés de la hampe | jusqu'à 1 |
| Traits qui se croisent hors de la hampe | 0,15 par croisement |
| Une lettre dessinée entièrement à l'intérieur d'une autre | 1 par lettre |
| Lettres rapetissées par une longue hampe (sous 30 % de la zone de dessin) | jusqu'à 3 |

Une hachure pèse dix fois plus que toutes les autres mesures réunies sur les mots qui ont
servi à régler le score, pour qu'une rune avec une hachure ne l'emporte pas sur une rune
propre.

Le panneau indique combien de runes ont été tirées et laquelle a été retenue.

## 6. Simplification

La hampe et les lettres partagent des traits. Là où ils se recouvrent, la partie commune
n'est tracée qu'une fois, les points presque confondus sont fusionnés, et les tronçons
droits perdent leurs points intermédiaires inutiles. Une hachure qui subsiste sur un mot
très long est corrigée en posant le trait le plus court sur le plus long. Un sigil de
Spare ne porte ni marque de départ ni marque d'arrivée : il n'a pas de sens de lecture.

## Déterminisme

Le hasard de la composition vient d'une **graine** : une empreinte de la méthode, des
lettres retenues, de l'option de voyelles et du numéro de variante. La même graine donne
toujours la même rune. Donc :

- le même mot avec la même option et la même variante donne le même sigil, après un
  rechargement ou sur un autre appareil ;
- deux mots qui se réduisent aux mêmes lettres donnent le même sigil : « Calme » et
  « calme ! » sont identiques ;
- changer l'option de voyelles ou la variante donne un autre sigil.

Le générateur est déterministe à dessein et n'utilise jamais les nombres aléatoires du
navigateur. Il n'est pas fait pour un usage de sécurité.

## Le voir dans l'app

Le panneau « Comment c'est fait » suit ces étapes : lettres retirées, squelettes anguleux
(la lettre d'origine en trait fin sous son squelette), accroche sur la hampe, choix de la
variante, simplification.
