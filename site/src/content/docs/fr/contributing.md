---
title: Contribuer
description: Comment proposer une modification de Sigil, les vérifications à passer, comment documenter le code, et comment mettre à jour cette documentation.
---

## Avant de commencer

- Lisez [Architecture](/sigil/docs/fr/architecture/) : chaque fonctionnalité a son dossier
  sous `src/features/` et une API publique dans son `index.ts`.
- Les décisions et leurs raisons sont consignées dans `docs/03-plan.md` (en français). Une
  modification qui va contre l'une d'elles commence par une discussion, pas par une pull
  request.

## Faire une modification

1. Travaillez sur une branche, pas sur `main` : chaque push sur `main` est déployé.
2. Gardez chaque commit petit et nommé à la manière conventionnelle, avec la tâche ou la
   fonctionnalité en scope quand il y en a une, par exemple `feat(T24): …`, `fix(T23): …`,
   `test(F2): …`, `docs: …`.
3. Donnez à chaque règle métier un test unitaire, et à chaque bug corrigé un test qui
   échoue sans le correctif.
4. Lancez toutes les vérifications avant de pousser :

```sh
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run test:scripts
npm run test:e2e
```

Le workflow de déploiement lance les mêmes vérifications, sauf les tests de bout en bout,
dont il ne joue que ceux de confidentialité, de CSP et de hors ligne.

## Écrire un code qui se documente

Code, commentaires et messages techniques sont en anglais ; les textes de l'interface sont
dans les deux dictionnaires, `src/app/strings.fr.ts` et `src/app/strings.en.ts`.

ESLint impose le TSDoc (`eslint-plugin-jsdoc`) :

- chaque fichier commence par un en-tête : sa responsabilité, ce qu'il expose, et ce qu'il
  ne fait pas quand la confusion est possible ;
- chaque fonction, méthode, classe et fonction fléchée exportée a son commentaire : ce
  qu'elle fait, ses paramètres (`@param name - description`, avec unité, format ou plage),
  ce qu'elle renvoie, les erreurs qu'elle lève et ses effets de bord ;
- les types ne sont pas répétés dans les commentaires : TypeScript les déclare.

Cette documentation est la référence d'API : écrivez-la pour un lecteur qui n'a pas le
code sous les yeux. Si un comportement change, son commentaire change dans le même commit.

## Mettre à jour cette documentation

La documentation vit dans `site/` (Starlight). Les pages sont dans
`site/src/content/docs/en/` et `site/src/content/docs/fr/`, avec les mêmes noms de
fichiers.

1. Écrivez ou modifiez d'abord la page anglaise, puis la française, avec les mêmes
   sections dans le même ordre.
2. Employez les termes du glossaire, `site/glossary.md`, et ajoutez-y tout nouveau terme.
3. Écrivez les liens internes avec le chemin de base complet, par exemple
   `/sigil/docs/fr/guide/export/` : le build échoue sur un lien cassé ou relatif.
4. Ne modifiez jamais `site/src/content/docs/en/reference/` : il est généré à chaque build
   à partir du TSDoc du code. Si la référence est fausse, corrigez le commentaire dans le
   code.
5. Vérifiez le build :

```sh
cd site
npm run build
```

Les captures d'écran vont dans `site/src/assets/screenshots/`. Prenez-les sur un build local
de l'app avec un mot d'exemple neutre (comme « Calme »), jamais avec une vraie intention.
