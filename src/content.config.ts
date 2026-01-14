import { file, glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'

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
    toc: z.boolean().optional().default(false),
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
    toc: z.boolean().optional().default(false),
  }),
})

export const collections = {
  categories: categoriesCollection,
  friends: friendsCollection,
  tags: tagsCollection,
  posts: postsCollection,
  pages: pagesCollection,
}
