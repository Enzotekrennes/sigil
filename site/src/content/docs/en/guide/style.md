---
title: Style, theme and language
description: Stroke width, rounded ends, framing circle, tattoo stencil mode, colour themes and interface language.
---

The **Style** section changes how the sigil is drawn, never its shape. A change shows at
once, without replaying the animation. On a wide screen the section is open in the left
column; on a narrow screen it is folded under the sigil.

Style settings are not saved: a reload brings back the defaults.

## Style settings

| Setting | Default | Range | Effect |
|---|---|---|---|
| **Stroke width** | 1.2 (thin) | 0.4 to 2.4, in steps of 0.2 | Thickness of the line, on a frame 100 units wide. The value is shown with a word: thin, medium or thick. |
| **Rounded ends** | on | on / off | On: round line ends and joins. Off: flat ends and sharp corners. |
| **Framing circle** | off | on / off | Draws a circle around the sigil, with the same stroke. |
| **Tattoo stencil** | off | on / off | See below. |

On kamea sigils, the start circle, the end bar and the loops follow the stroke width,
up to a size that keeps them inside their cell.

## Tattoo stencil mode

Turn on **Tattoo stencil** to prepare a sigil for a tattoo artist:

- the sigil is drawn in pure black on white, as a single line, without the framing circle;
- the stroke width is set in **millimetres on paper**: from 0.3 to 1.2 mm, 0.6 mm by
  default;
- the width is calculated for the print size set in the **Export** dialog (8 cm by
  default), so what you see matches what will be printed.

The stencil is what the PDF export always produces. See
[Export](/sigil/docs/en/guide/export/).

## Theme

The theme selector sits in the header, next to the language selector. It has three
choices, shown as icons:

- **System**: follows the light or dark setting of your device (the default);
- **Ink on paper**: dark ink on a paper background, with a red accent that never touches
  the sigil;
- **Gold on black**: gold lines on a black background.

Your choice is remembered on this device. Going back to **System** forgets it.

## Interface language

The **FR | EN** selector switches the interface between French and English. Switching
keeps the word typed, the sigil shown and its animation as they are.

On the first visit, the interface is in English when the browser’s first language is
English, and in French otherwise. Once you pick a language, it is remembered on this
device.

See [Privacy](/sigil/docs/en/privacy/) for what “remembered” means exactly.
