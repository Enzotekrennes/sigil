// @ts-check
/**
 * Configuration of the Sigil documentation site (Starlight on Astro).
 *
 * The site is bilingual: English is the source language (`en/`), French the
 * translation (`fr/`), with the same file names in both. It is published as a
 * sub-folder of the app's GitHub Pages site, hence the `/sigil/docs` base: the
 * app lives at `/sigil/`, this site at `/sigil/docs/`. Every internal link in
 * the pages is written with that base, and `starlight-links-validator` fails
 * the build on a broken one.
 *
 * The API reference is generated at build time from the app's TSDoc by
 * `starlight-typedoc` into `src/content/docs/en/reference/` (English only,
 * never edited by hand, not versioned). Its entry points are the public
 * modules of the app: `src/features/<feature>/index.ts`, the shared sigil model
 * `src/features/sigil/types.ts` (imported directly by the methods, outside the
 * feature's `index.ts`) and `src/lib/random.ts`.
 *
 * No external resource: system fonts, local search (Pagefind), no analytics,
 * no social or edit links.
 */
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLinksValidator from 'starlight-links-validator';
import starlightTypeDoc, { typeDocSidebarGroup } from 'starlight-typedoc';

/** Public path of the site: a sub-folder of the app's GitHub Pages project site. */
const BASE_PATH = '/sigil/docs';

/** Root of the app, one level up, relative to this file. */
const APP_ROOT = '../';

/** Features of the app whose public API (`index.ts`) is documented in the API reference. */
const REFERENCE_FEATURES = ['explain', 'export', 'i18n', 'intention', 'kamea', 'sigil', 'spare'];

/** Every module documented in the API reference. */
const REFERENCE_ENTRY_POINTS = [
  ...REFERENCE_FEATURES.map((feature) => `${APP_ROOT}src/features/${feature}/index.ts`),
  `${APP_ROOT}src/features/sigil/types.ts`,
  `${APP_ROOT}src/lib/random.ts`,
];

/**
 * Paths outside this site that the pages link to: the app itself and the legal
 * files it publishes at its root. The links validator only knows the pages of
 * this site, so these are excluded from its checks.
 */
const APP_LINKS = [
  '/sigil/',
  '/sigil/LICENSE.txt',
  '/sigil/NOTICE.txt',
  '/sigil/THIRD-PARTY-LICENSES.txt',
  '/sigil/OFL-EB-Garamond.txt',
  '/sigil/OFL-IBM-Plex-Mono.txt',
];

export default defineConfig({
  base: BASE_PATH,
  // Every page lives under a locale; the bare `/sigil/docs/` sends visitors to the
  // English home page, the source language (a static HTML redirect).
  redirects: { '/': `${BASE_PATH}/en/` },
  integrations: [
    starlight({
      title: { en: 'Sigil docs', fr: 'Documentation Sigil' },
      description: 'How to use Sigil, how its two sigil methods work, and how it is built.',
      favicon: '/favicon.svg',
      defaultLocale: 'en',
      locales: {
        en: { label: 'English', lang: 'en' },
        fr: { label: 'Français', lang: 'fr' },
      },
      customCss: ['./src/styles/theme.css'],
      plugins: [
        starlightTypeDoc({
          entryPoints: REFERENCE_ENTRY_POINTS,
          tsconfig: `${APP_ROOT}tsconfig.app.json`,
          output: 'en/reference',
          sidebar: { label: 'API reference', collapsed: true },
          typeDoc: {
            name: 'Sigil API reference',
            // Module pages named `index.md`: each module keeps its overview page (the
            // list of its exports), which the plugin drops when it is a `README.md`.
            entryFileName: 'index.md',
            // No "Defined in" links: the repository URL is not fixed yet, and the
            // reference is read for the documented contract, not the code.
            disableSources: true,
          },
        }),
        starlightLinksValidator({ exclude: APP_LINKS }),
      ],
      sidebar: [
        {
          label: 'Start here',
          translations: { fr: 'Pour commencer' },
          items: [{ slug: 'index' }],
        },
        {
          label: 'User guide',
          translations: { fr: "Guide d'usage" },
          items: [
            { slug: 'guide/trace' },
            { slug: 'guide/style' },
            { slug: 'guide/export' },
            { slug: 'guide/offline' },
            { slug: 'privacy' },
          ],
        },
        {
          label: 'The methods',
          translations: { fr: 'Les méthodes' },
          items: [{ slug: 'methods/kamea' }, { slug: 'methods/spare' }, { slug: 'methods/limits' }],
        },
        {
          label: 'For developers',
          translations: { fr: 'Pour les développeurs' },
          items: [
            { slug: 'getting-started' },
            { slug: 'architecture' },
            { slug: 'operations' },
            { slug: 'contributing' },
          ],
        },
        typeDocSidebarGroup,
        {
          label: 'About',
          translations: { fr: 'À propos' },
          items: [{ slug: 'credits' }],
        },
      ],
    }),
  ],
});
