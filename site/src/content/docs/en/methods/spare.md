---
title: Spare's method
description: How Sigil reduces a word with Austin Osman Spare's method and composes the remaining letters into a bind rune.
---

Austin Osman Spare's method removes the letters of an intention until only a few remain,
then fuses them into one glyph that no longer reads as a word. Sigil composes that glyph
as a **bind rune**: angular letters hooked onto a vertical **stem**, taller than wide,
often symmetric.

## 1. Letter reduction

The word is normalised as for the kamea (accents removed, capitals, A to Z only), then:

1. every **repeated letter** is removed: the first occurrence stays, in its place;
2. then the **vowels** A, E, I, O, U are removed, unless **Keep the vowels** is on.

Y is not removed: it often works as a consonant, and keeping it leaves one more letter on
short words. A repeated vowel is counted as a duplicate, since duplicates go first.

**Example**: “Tranquillité” gives the duplicates L, I, T, the vowels A, U, I, E, and keeps
**T R N Q L**.

If nothing remains (a word made only of vowels, such as “oui”), the app offers to keep the
vowels.

## 2. Angular skeletons

Each kept letter starts from its single-stroke skeleton in the **Hershey Roman Simplex**
font (capitals A to Z). Every curve of that skeleton is redrawn as two to four straight
segments, so the rune is made of straight strokes only: S becomes a zigzag, O a diamond,
C a bracket, and the bowls of B, D, P and R become triangles.

## 3. Hooking onto the stem

A vertical line, the **stem**, runs through the sigil from top to bottom. Each letter
hooks onto it in one of three ways:

- **on the stem**: a letter with a vertical stroke lays it on the stem (B, D, E, F, H,
  I, J, K, L, M, N, P, R, T, U; Y forks off it with its half stem);
- **centred**: the stem runs through its middle (an O becomes a diamond threaded on it);
- **hanging**: it touches the stem by its single outermost point (the point of a C).

Letters are hung one below the other. A letter may be **mirrored** left to right, two
letters may share a height on either side of the stem, and a letter may be **doubled** by
its mirror image on the other side, which makes the rune symmetric. Consecutive letters may
overlap a little on the stem, and a bare length of stem extends above and below the
letters.

## 4. Variants and their style

Each variant has a **style**:

- **symmetric**: every letter set on one side of the stem is doubled by its mirror image;
- **paired**: no letter is doubled, and one-sided letters face each other across the stem;
- **mixed**: some letters are doubled, others stay on one side.

Short words (up to four kept letters) go through symmetric, paired, then mixed; longer
words alternate mixed and paired, because a symmetric rune would hang one small letter
per level along a long stem.

The first variant hangs the letters in the order of the word. With three letters or fewer,
the following variants go through every possible order in turn; beyond, each variant
shuffles the letters in its own way.

## 5. Choosing the rune

For each variant, Sigil composes between 24 and 64 candidate runes (fewer for long words,
so that every word takes about the same time), fits each into a disc inside the frame,
and gives each a **penalty**; the lowest penalty wins. The penalty counts:

| What is measured | Penalty |
|---|---|
| Hatches: parallel strokes a hair apart, which read as a blurred line | 10 per hatch |
| Ink beyond a ceiling (6.5 times the side of the drawing area) | 0.5 per tenth of the ceiling over |
| A silhouette more than 2.5 times taller than wide | 2 per unit of ratio over |
| Asymmetry, depending on the style (symmetric / mixed / paired) | up to 2 / 1 / 0.5 |
| Imbalance between the two sides of the stem | up to 1 |
| Strokes crossing one another away from the stem | 0.15 per crossing |
| A letter drawn fully inside another one | 1 per letter |
| Letters shrunk by a long stem (below 30 % of the drawing area) | up to 3 |

A hatch weighs ten times more than all the other measures together on the words used to
tune the score, so that a rune with a hatch does not win over a clean one.

The panel says how many runes were drawn and which one was kept.

## 6. Simplification

The stem and the letters share strokes. Where they overlap, the shared part is drawn only
once, points that nearly coincide are merged, and straight runs lose their useless middle
points. A hatch that a very long word still has is corrected by laying the shorter stroke
onto the longer one. A Spare sigil carries no start or end mark: it has no reading
direction.

## Determinism

The randomness of the composition comes from a **seed**: a hash of the method, the kept
letters, the vowel option and the variant number. The same seed always gives the same
rune. So:

- the same word with the same option and variant gives the same sigil, after a reload or
  on another device;
- two words that reduce to the same letters give the same sigil: “Calme” and “calme !”
  are the same;
- changing the vowel option or the variant gives another sigil.

The generator is deterministic on purpose and never uses the browser's random numbers. It
is not meant for anything security related.

## See it in the app

The “How it’s made” panel follows these steps: letters removed, angular skeletons (the
original letter in a thin line under its skeleton), hooking onto the stem, choice of the
variant, simplification.
