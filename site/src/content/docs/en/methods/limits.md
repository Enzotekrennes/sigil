---
title: Limits and choices
description: What Sigil deliberately does not do, and what to know before using a sigil, especially a kamea one.
---

## A kamea sigil can be read back

The kamea method is a public rule. Someone who knows it, and recognises the square, can
read the cell numbers off the path and work back to the letters. On the squares of 36
cells and more (Sun, Venus, Mercury, Moon), each number is one letter; on the smaller
squares, several letters share a number, which only narrows the guess.

A Spare sigil is far less reversible: duplicates and vowels are gone, and the letters are
mirrored, doubled and merged into a rune.

The app says so in the export dialog of a kamea sigil and in its privacy note. If the word
must stay private, prefer Spare's method.

## One word, Latin letters

- The intention is **one word** of at most **24 letters**: beyond one word, or beyond that
  length, the sigil becomes unreadable.
- Only the letters **A to Z** are traced. Accented letters are reduced to their base
  letter; other scripts, digits and symbols are ignored.

## Choices of the methods

- **Kamea**: the letter → number rule is the alphabetical rank wrapped around the square,
  A = 1 … Z = 26, for the seven squares. Other conversions (Pythagorean reduction on every
  square, Hebrew gematria) are not offered.
- **Kamea** keeps every letter, repetitions included: the path follows the word as typed.
- **Spare** always removes duplicates, removes the vowels by default, and keeps Y.
- **Spare** composes a bind rune with straight strokes. It does not reproduce a free,
  hand-drawn superimposition of letters.

## What has not been checked

- The app is tested in Chromium. Other browsers have not been tested.
- The real size of the PDF is checked by automated tests on the file; printing depends on
  the printer and its settings. Always check the 1 cm ruler on paper
  (see [Export](/sigil/docs/en/guide/export/)).
