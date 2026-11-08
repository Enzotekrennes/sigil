---
title: The kamea method
description: How a word becomes a path on one of Agrippa's seven planetary magic squares, with its start, end and loop marks.
---

A **kamea** is a planetary **magic square**: a grid of N × N cells holding the numbers 1
to N², where every row, column and diagonal has the same sum. The method turns each letter
of the word into a number, then joins the matching cells of the square with one line.

## The seven squares

Sigil uses the seven squares of Agrippa (*De occulta philosophia*, 1533, book II,
chapter 22), in their traditional arrangement. The unit tests check every row, column and
diagonal sum, and that each square holds 1 to N² exactly once.

| Planet | Size | Cells |
|---|---|---|
| Saturn | 3×3 | 9 |
| Jupiter | 4×4 | 16 |
| Mars | 5×5 | 25 |
| Sun | 6×6 | 36 |
| Venus | 7×7 | 49 |
| Mercury | 8×8 | 64 |
| Moon | 9×9 | 81 |

The square of Saturn, for instance:

```
4  9  2
3  5  7
8  1  6
```

## From letters to numbers

1. The word is normalised: accents removed, capitals, only A to Z kept. The kamea method
   keeps **every** letter, repeated ones included.
2. Each letter takes its rank in the alphabet: A = 1, B = 2 … Z = 26.
3. The rank wraps around the N² cells of the chosen square:

```
number = ((rank − 1) mod N²) + 1
```

On Saturn (9 cells), L (rank 12) gives ((12 − 1) mod 9) + 1 = 3. On Saturn this rule is
the Pythagorean reduction. From the Sun on (36 cells and more), every letter keeps its
rank; on Mars (25 cells), only Z wraps back to 1.

**Example**: “Calme” on Saturn gives C = 3, A = 1, L = 12 → 3, M = 13 → 4, E = 5: the
path joins the cells **3, 1, 3, 4, 5**.

## The path and its marks

The line runs through the centres of the cells, in the order of the letters. Three marks
make it readable:

- a **start circle** on the first cell;
- an **end bar** across the last cell, perpendicular to the last segment;
- a **loop** on a cell reached several times in a row: the same letter twice (“ll”), or
  two different letters that land on the same cell (on Saturn, A and J both give 1).

A cell gets a single loop even when several separate runs fall on it: the path already
shows how often it is visited, and stacked loops would merge into a blot on the small
cells of the Moon. A loop on the last cell sits beside the last segment, clear of the end
bar.

The marks are sized to the cells of the square, so they stay inside their cell from the
3×3 to the 9×9, and they follow the stroke width up to a cap.

## Determinism

The method draws nothing at random: the same word on the same square always gives the
same sigil.

## When a word cannot be traced

- **A single letter** makes no path: write at least two letters.
- **Every letter on the same cell** (for example “AJ” on Saturn) would trace a single dot:
  choose another square or add letters.

## See it in the app

The “How it’s made” panel shows the rule for the chosen square with an example, the
letter → number table, and the square with the path drawn over it.

See also [Limits](/sigil/docs/en/methods/limits/): a kamea sigil can be read back by
someone who knows the method.
