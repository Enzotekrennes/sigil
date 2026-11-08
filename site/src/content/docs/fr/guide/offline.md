---
title: Hors ligne et installation
description: Utiliser Sigil sans connexion après une première visite, l'installer comme une application, et recevoir les mises à jour.
---

## Utilisation hors ligne

Sigil est un site statique : une fois chargé, tout s'exécute dans le navigateur. À la
première visite, un service worker enregistre sur l'appareil chaque fichier de l'app
(scripts, styles, polices, icônes et fichiers de licence). Ensuite, Sigil s'ouvre et
fonctionne sans connexion : tracé, panneau « Comment c'est fait » et trois exports compris.

## Installation

Sigil est une application web installable (PWA). Les navigateurs qui gèrent l'installation
proposent de l'ajouter à l'écran d'accueil ou à la liste des applications ; elle s'ouvre
alors dans sa propre fenêtre, sans la barre d'adresse du navigateur, et fonctionne hors
ligne comme le site.

## Mises à jour

Quand une nouvelle version est publiée, elle est prise en compte à la visite suivante : le
service worker remplace les fichiers enregistrés par les nouveaux, sans rien demander.

## Où la trouver

L'app est publiée sur GitHub Pages sous le chemin `/sigil/`. Cette documentation se trouve
à côté, sous `/sigil/docs/` ; contrairement à l'app, elle demande une connexion.

- [Ouvrir l'app](/sigil/)
