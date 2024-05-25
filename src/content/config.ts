import { imageMetadata } from '@/helpers/images';
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
        poster: z.string(),
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

// Options Collection
const optionsCollection = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string().max(40),
    website: z
      .string()
      .url()
      .transform((value) => (import.meta.env.DEV ? 'http://localhost:4321' : value)),
    description: z.string().max(100),
    keywords: z.array(z.string()),
    author: z.object({ name: z.string(), email: z.string().email(), url: z.string().url() }),
    navigation: z.array(z.object({ text: z.string(), link: z.string(), target: z.string().optional() })),
    socials: z.array(
      z.object({
        name: z.string(),
        icon: z.string(),
        type: z.enum(['link', 'qrcode']),
        title: z.string().optional(),
        link: z.string().url(),
      }),
    ),
    settings: z.object({
      initialYear: z.number().max(2024),
      icpNo: z.string().optional(),
      locale: z.string().optional().default('zh-CN'),
      timeZone: z.string().optional().default('Asia/Shanghai'),
      timeFormat: z.string().optional().default('yyyy-MM-dd HH:mm:ss'),
      twitter: z.string(),
      post: z.object({
        sort: z.enum(['asc', 'desc']),
        feature: z.array(z.string()).optional(),
        category: z.array(z.string()).optional(),
      }),
      pagination: z.object({
        posts: z.number().optional().default(5),
        category: z.number().optional().default(7),
        tags: z.number().optional().default(7),
        search: z.number().optional().default(7),
      }),
      feed: z.object({
        full: z.boolean().optional().default(true),
        size: z.number().optional().default(20),
      }),
      sidebar: z.object({
        search: z.boolean().default(false),
        post: z.number().default(6),
        comment: z.number().default(0),
        tag: z.number().default(20),
      }),
      comments: z.object({
        server: z.string().url().readonly(),
        admins: z.array(z.number()).readonly(),
      }),
    }),
  }),
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
  options: optionsCollection,
  pages: pagesCollection,
  posts: postsCollection,
  tags: tagsCollection,
};
