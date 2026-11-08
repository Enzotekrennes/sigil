---
title: Privacy
description: What stays in the browser, the two preferences stored on the device, and what the host sees.
---

An intention can be intimate. Sigil is built so that it never leaves the browser.

## What happens to the word you type

Everything happens in the browser. The intention is **never sent** anywhere and **never
saved**:

- not in the page address: the form is never submitted;
- not on the device: it lives in the page’s memory only, and is gone when the page is
  closed;
- not in exported files: their name says only the method and the date, and the PDF
  metadata only “Sigil” and the date.

The intention field and the letters of the “How it’s made” panel are marked so that a
browser’s page translation leaves them alone.

## What is stored on the device

Only two preferences, in the browser’s local storage, and only once you pick them:

| Key | Values | Written when |
|---|---|---|
| `sigil.language` | `fr` or `en` | you choose a language with **FR \| EN** |
| `sigil.theme` | `light` or `dark` | you choose **Ink on paper** or **Gold on black**; removed when you go back to **System** |

A visitor who never touches these selectors leaves the storage empty. The offline copy of
the app (see [Offline and installation](/sigil/docs/en/guide/offline/)) holds the app’s
files only.

## No third party

- No cookies, no analytics, no font or script from another site: the
  fonts are served by the site itself.
- A Content Security Policy restricts the page to its own origin: no request can go to
  another site, and no form can be submitted.
- The page never tells another site which page a visitor came from (no referrer).

## The host

The site is hosted by **GitHub Pages**, which logs visitors’ IP addresses under its own
privacy policy. The site itself transmits nothing.

This documentation follows the same rules: static pages, a search index built into the
site, no analytics.

## A kamea sigil can be read back

Privacy also depends on the method: someone who knows the kamea method can read the
letters back from a kamea sigil. See [Limits](/sigil/docs/en/methods/limits/).
