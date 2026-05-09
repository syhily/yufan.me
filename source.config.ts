import { defineCollections, defineConfig } from 'fumadocs-mdx/config'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeSlug from 'rehype-slug'
import rehypeTitleFigure from 'rehype-title-figure'
import remarkMath from 'remark-math'
import { z } from 'zod'

import rehypeMermaid from './src/server/markdown/mermaid/index.ts'
import { rehypeCodeWithGlobalCache } from './src/server/markdown/rehype-code.ts'
import rehypeMathjax from './src/server/markdown/rehype-mathjax.ts'
import remarkCollectImages from './src/server/markdown/remark-collect-images.ts'

// SLUG NAMESPACE — global. Every value emitted by `contentSlug()`
// (post `slug`, post `alias[]`) lives in **one** namespace shared
// with the DB-side `page` table's `slug` column (`src/server/db/schema.ts`).
// The public routes physically separate posts (`/posts/:slug`)
// from pages (`/:slug`), but the catalog, OG generator, comment
// threading and sitemap all key on the slug independent of the
// prefix. Catalog cold start fences this with `validatePageSlugs`
// / `indexPosts` in `@/server/catalog/catalog`; refuse to introduce
// another slug emitter without first reading those validators.
function contentSlug() {
  return z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i, 'Invalid content slug')
}

const postSchema = z.object({
  title: z.string().max(99),
  slug: contentSlug(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  comments: z.boolean().optional().default(true),
  // Each alias also occupies a slot in the global slug namespace
  // documented above. Aliases let an old permalink keep resolving
  // after a rename without breaking inbound links.
  alias: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  category: z.string(),
  summary: z.string().optional().default(''),
  cover: z.url().optional(),
  og: z.string().optional(),
  published: z.boolean().optional().default(true),
  visible: z.boolean().optional().default(true),
  toc: z.boolean().optional().default(false),
})

// `categories`, `tags`, and `friends` used to live here as Fumadocs
// meta collections backed by `src/content/metas/{categories,tags,friends}.yaml`.
// They now live in the `category`, `tag`, and `friend` Postgres
// tables — see `@/server/categories/service`, `@/server/tags/service`,
// and `@/server/friends/service` and the matching `/wp-admin/*` admin
// pages. New entries land directly through the admin UI; tag slugs
// are derived server-side via `pinyin-pro` (kept out of the SSR
// bundle by virtue of living under `src/server/`).
//
// `pages` used to be a Fumadocs collection too (`src/content/pages/*.mdx`,
// schema mirroring `postSchema`). Pages now live exclusively in the
// `page` + `content` Postgres tables and are edited through
// `/wp-admin/pages`; the in-tree MDX collection has been retired.
// The `src/content/pages/` directory is intentionally kept on disk —
// the three historical files (about / guestbook / links) survive
// there as **frozen migration source material** that the importer
// (`scripts/migrate/pages/cli.ts`) can be pointed at on a fresh
// production deployment. They are not walked at build time and do
// not reach the SSR bundle. See `src/content/pages/_README.md` and
// `scripts/migrate/README.md` for the operator workflow.

export const posts = defineCollections({
  type: 'doc',
  dir: 'src/content/posts',
  files: ['**/[^_]*.mdx'],
  schema: postSchema,
})

const rehypeCodeOptions = {
  themes: {
    light: 'github-light',
    dark: 'github-dark',
  },
  addLanguageClass: true,
  fallbackLanguage: 'plaintext',
  langAlias: {
    math: 'plaintext',
  },
} satisfies Partial<import('fumadocs-core/mdx-plugins/rehype-code').RehypeCodeOptions>

export default defineConfig({
  mdxOptions: {
    remarkImageOptions: false,
    rehypeCodeOptions,
    valueToExport: ['imageSources'],
    remarkPlugins: [remarkMath, remarkCollectImages],
    rehypePlugins: (plugins) => [
      [rehypeMathjax, { svg: { fontCache: 'global' } }],
      [
        rehypeMermaid,
        {
          theme: 'solarized-light',
          renderOptions: { transparent: true },
        },
      ],
      [rehypeCodeWithGlobalCache, rehypeCodeOptions],
      [rehypeTitleFigure],
      [rehypeExternalLinks, { rel: 'nofollow', target: '_blank' }],
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'append', properties: {} }],
      ...plugins.slice(1),
    ],
  },
})
