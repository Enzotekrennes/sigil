/**
 * Content collection of the documentation site: the pages, under
 * `src/content/docs/<locale>/`. Starlight's own interface labels come with
 * Starlight in both languages; no `i18n` collection overrides them.
 */
import { defineCollection } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
};
