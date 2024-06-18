import { imageMetadata } from '@/helpers/images';
import { urlJoin } from '@/helpers/tools';
import options from '@/options';
import { defineCollection, z } from 'astro:content';

export const defaultCover = '/images/default-cover.jpg';

// Copied and modified from https://github.com/zce/velite/blob/main/src/schemas/slug.ts
// The slug is internally supported by Astro with 'content' type.
// We add the slug here for validating the YAML configuration.
const slug = () =>
  z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Invalid slug');

const image = (fallbackImage: string) =>
  z
    .string()
    .optional()
    .default(fallbackImage)
    .transform(async (arg) => await imageMetadata(arg));

// Categories Collection
const categoriesCollection = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string().max(20),
    slug: slug(),
    cover: image(defaultCover),
    description: z.string().max(999).optional(),
  }),
});

// Friends Collection
const friendsCollection = defineCollection({
  type: 'data',
  schema: z.array(
    z
      .object({
        website: z.string().max(40),
        description: z.string().optional(),
        homepage: z.string().url(),
        poster: z
          .string()
          .transform((poster) => (poster.startsWith('/') ? urlJoin(options.assetsPrefix(), poster) : poster)),
        favicon: z.string().optional(),
      })
      .transform((data) => {
        if (data.favicon === undefined) {
          data.favicon = `${data.homepage}/favicon.ico`;
        }
        return data;
      }),
  ),
});

// Posts Collection
const postsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().max(99),
    date: z.date(),
    updated: z.date().optional(),
    comments: z.boolean().optional().default(true),
    tags: z.array(z.string()).optional().default([]),
    category: z.string(),
    summary: z.string().optional().default(''),
    cover: image(defaultCover),
    published: z.boolean().optional().default(true),
  }),
});

// Pages Collection
const pagesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().max(99),
    date: z.date(),
    updated: z.date().optional(),
    comments: z.boolean().optional().default(true),
    cover: image(defaultCover),
    published: z.boolean().optional().default(true),
    friend: z.boolean().optional().default(false),
  }),
});

// Tags Collection
const tagsCollection = defineCollection({
  type: 'data',
  schema: z.array(
    z.object({
      name: z.string().max(20),
      slug: slug(),
    }),
  ),
});

export const collections = {
  categories: categoriesCollection,
  friends: friendsCollection,
  pages: pagesCollection,
  posts: postsCollection,
  tags: tagsCollection,
};
