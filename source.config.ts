import { defineCollections, defineConfig } from 'fumadocs-mdx/config'
import { pinyin } from 'pinyin-pro'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeSlug from 'rehype-slug'
import rehypeTitleFigure from 'rehype-title-figure'
import remarkMath from 'remark-math'
import { z } from 'zod'

import rehypeMermaid from './src/server/markdown/mermaid/index.ts'
import { rehypeCodeWithGlobalCache } from './src/server/markdown/rehype-code.ts'
import { rehypeImageEnhance } from './src/server/markdown/rehype-image-enhance.ts'
import rehypeMathjax from './src/server/markdown/rehype-mathjax.ts'

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

// Tags are authored as `{ name, slug? }` in `tags.yaml`. We derive missing
// slugs at MDX compile time via `pinyin-pro` so the SSR bundle never has to
// import it (1MB dep) and so authors can drop in a new `<post>.tags` entry
// without remembering to run a sync script. The transform fills `slug`
// in-place; runtime sees a fully-populated `Tag` shape.
export const tags = defineCollections({
  type: 'meta',
  dir: 'src/content/metas',
  files: ['tags.yaml'],
  schema: z
    .array(
      z.object({
        name: z.string().max(20),
        slug: slug().optional(),
      }),
    )
    .transform((entries) =>
      entries.map((entry) => ({
        ...entry,
        slug: entry.slug ?? derivedTagSlug(entry.name),
      })),
    ),
})

// Compile-time slug derivation for Chinese (or mixed) tag names. Outputs the
// same kebab-case ASCII form `slug()` validates so the runtime catalog can
// build URLs without round-tripping through `pinyin-pro` at request time.
// Punctuation in the source (e.g. `（）`) is dropped — `pinyin-pro` leaves
// these characters intact, but our slug regex only allows `[a-z0-9-]`.
function derivedTagSlug(name: string): string {
  return pinyin(name, {
    toneType: 'none',
    separator: '-',
    nonZh: 'consecutive',
    type: 'string',
  })
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

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
    remarkPlugins: [remarkMath],
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
      [rehypeImageEnhance],
      [rehypeTitleFigure],
      [rehypeExternalLinks, { rel: 'nofollow', target: '_blank' }],
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'append', properties: {} }],
      ...plugins.slice(1),
    ],
  },
})
