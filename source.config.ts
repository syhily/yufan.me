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

const pageSchema = z.object({
  title: z.string().max(99),
  slug: contentSlug(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  comments: z.boolean().optional().default(true),
  cover: z.url(),
  og: z.string().optional(),
  published: z.boolean().optional().default(true),
  summary: z.string().optional().default(''),
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

export const posts = defineCollections({
  type: 'doc',
  dir: 'src/content/posts',
  files: ['**/[^_]*.mdx'],
  schema: postSchema,
})

export const pages = defineCollections({
  type: 'doc',
  dir: 'src/content/pages',
  files: ['**/[^_]*.mdx'],
  schema: pageSchema,
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
