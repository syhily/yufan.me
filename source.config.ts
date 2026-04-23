import { defineCollections, defineConfig } from 'fumadocs-mdx/config'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeMathjax from 'rehype-mathjax'
import rehypeSlug from 'rehype-slug'
import rehypeTitleFigure from 'rehype-title-figure'
import remarkMath from 'remark-math'
import { z } from 'zod'

import rehypeMermaid from './src/services/markdown/mermaid'

function slug() {
  return z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Invalid slug')
}

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

export const categories = defineCollections({
  type: 'meta',
  dir: 'src/content/metas',
  files: ['categories.yaml'],
  schema: z.array(
    z.object({
      name: z.string().max(20),
      slug: slug(),
      cover: z.url(),
      description: z.string().max(999).optional().default(''),
    }),
  ),
})

export const friends = defineCollections({
  type: 'meta',
  dir: 'src/content/metas',
  files: ['friends.yaml'],
  schema: z.array(
    z.object({
      website: z.string().max(40),
      description: z.string().optional(),
      homepage: z.url(),
      poster: z.url(),
    }),
  ),
})

export const tags = defineCollections({
  type: 'meta',
  dir: 'src/content/metas',
  files: ['tags.yaml'],
  schema: z.array(
    z.object({
      name: z.string().max(20),
      slug: slug(),
    }),
  ),
})

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

export default defineConfig({
  mdxOptions: {
    remarkImageOptions: false,
    rehypeCodeOptions: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      fallbackLanguage: 'plaintext',
      langAlias: {
        math: 'plaintext',
      },
    },
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      [
        rehypeMermaid,
        {
          strategy: 'inline-svg',
          theme: 'solarized-light',
          renderOptions: { transparent: true },
        },
      ],
      [rehypeTitleFigure],
      [rehypeExternalLinks, { rel: 'nofollow', target: '_blank' }],
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'append', properties: {} }],
      [rehypeMathjax, { svg: { fontCache: 'none' } }],
    ],
  },
})
