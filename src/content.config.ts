import { Buffer } from 'node:buffer'
import { file, glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'
import { thumbHashToDataURL } from 'thumbhash'
import config from '@/blog.config'

// Copied and modified from https://github.com/zce/velite/blob/main/src/schemas/slug.ts
// The slug is internally supported by Astro with 'content' type.
// We add the slug here for validating the YAML configuration.
function slug() {
  return z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Invalid slug')
}

// The default toc heading level.
function toc() {
  return z
    .union([
      z.object({
        // The level to start including headings at in the table of contents. Default: 2.
        minHeadingLevel: z.number().int().min(1).max(6).optional().default(config.settings.toc.minHeadingLevel),
        // The level to stop including headings at in the table of contents. Default: 3.
        maxHeadingLevel: z.number().int().min(1).max(6).optional().default(config.settings.toc.maxHeadingLevel),
      }),
      z.boolean().transform(enabled =>
        enabled
          ? {
              minHeadingLevel: config.settings.toc.minHeadingLevel,
              maxHeadingLevel: config.settings.toc.maxHeadingLevel,
            }
          : false,
      ),
    ])
    .default(false)
    .refine(toc => (toc ? toc.minHeadingLevel <= toc.maxHeadingLevel : true), {
      message: 'minHeadingLevel must be less than or equal to maxHeadingLevel',
    })
}

// Categories Collection
const categoriesCollection = defineCollection({
  loader: file('./src/content/metas/categories.yml'),
  schema: z.object({
    name: z.string().max(20),
    slug: slug(),
    cover: z.string().url(),
    description: z.string().max(999).optional().default('').describe('In markdown format'),
  }),
})

// Friends Collection
const friendsCollection = defineCollection({
  loader: file('./src/content/metas/friends.yml'),
  schema: z.object({
    website: z.string().max(40),
    description: z.string().optional().describe('One line string'),
    homepage: z.string().url(),
    poster: z.string().url(),
  }),
})

// Tags Collection
const tagsCollection = defineCollection({
  loader: file('./src/content/metas/tags.yml'),
  schema: z.object({
    name: z.string().max(20),
    slug: slug(),
  }),
})

// Posts Collection
const postsCollection = defineCollection({
  loader: glob({ pattern: '**\/[^_]*.mdx', base: './src/content/posts' }),
  schema: z.object({
    title: z.string().max(99),
    date: z.date(),
    updated: z.date().optional(),
    comments: z.boolean().optional().default(true),
    alias: z.string().array().optional().default([]),
    tags: z.string().array().optional().default([]),
    category: z.string(),
    summary: z.string().optional().default(''),
    cover: z.string().url().optional(),
    og: z.string().optional(),
    published: z.boolean().optional().default(true),
    visible: z.boolean().optional().default(true),
    toc: toc(),
  }),
})

// Pages Collection
const pagesCollection = defineCollection({
  loader: glob({ pattern: '**\/[^_]*.mdx', base: './src/content/pages' }),
  schema: z.object({
    title: z.string().max(99),
    date: z.date(),
    updated: z.date().optional(),
    comments: z.boolean().optional().default(true),
    cover: z.string().url(),
    og: z.string().optional(),
    published: z.boolean().optional().default(true),
    summary: z.string().optional(),
    toc: toc(),
  }),
})

const imageCollection = defineCollection({
  loader: file('./src/content/metas/images.yml'),
  schema: z.object({
    slug: z.string(),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    blurhash: z.string().transform(hash => thumbHashToDataURL(Buffer.from(hash, 'base64'))),
  }),
})

const musicCollection = defineCollection({
  loader: glob({ pattern: '**\/[^_]*.yml', base: './src/content/metas/musics' }),
  schema: z.object({
    id: z.string().regex(/\d+/),
    name: z.string(),
    artist: z.string(),
    album: z.string(),
    pic: z.string().url(),
    lyric: z.string(),
    url: z.string().url(),
  }),
})

export const collections = {
  categories: categoriesCollection,
  friends: friendsCollection,
  tags: tagsCollection,
  posts: postsCollection,
  pages: pagesCollection,
  images: imageCollection,
  musics: musicCollection,
}
