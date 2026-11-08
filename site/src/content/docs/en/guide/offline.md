---
title: Offline and installation
description: Use Sigil without a connection after a first visit, install it as an app, and get updates.
---

## Offline use

Sigil is a static site: once loaded, everything runs in the browser. On the first visit, a
service worker stores every file of the app on the device (scripts, styles, fonts, icons
and the legal files). After that, Sigil opens and works without a connection: tracing,
the “How it’s made” panel and the three exports included.

## Installation

Sigil is an installable web app (PWA). Browsers that support installation offer to add it
to the home screen or the applications list; it then opens in its own window, without the
browser’s address bar, and works offline like the site.

## Updates

When a new version is published, it is picked up on the next visit: the service worker
replaces the stored files with the new ones, without asking anything.

## Where it lives

The app is published on GitHub Pages under the `/sigil/` path. This documentation lives
next to it, under `/sigil/docs/`; unlike the app, it needs a connection.

- [Open the app](/sigil/)
