import { imageMetadata } from '@/helpers/images';
import { urlJoin } from '@/helpers/tools';
import options from '@/options';
import { file, glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';
import { glob as Glob } from 'glob';
import path from 'node:path';

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

const image = (fallbackImage: string) => z.string().optional().default(fallbackImage);

// The default toc heading level.
const toc = () =>
  z
    .union([
      z.object({
        // The level to start including headings at in the table of contents. Default: 2.
        minHeadingLevel: z.number().int().min(1).max(6).optional().default(options.settings.toc.minHeadingLevel),
        // The level to stop including headings at in the table of contents. Default: 3.
        maxHeadingLevel: z.number().int().min(1).max(6).optional().default(options.settings.toc.maxHeadingLevel),
      }),
      z.boolean().transform((enabled) =>
        enabled
          ? {
              minHeadingLevel: options.settings.toc.minHeadingLevel,
              maxHeadingLevel: options.settings.toc.maxHeadingLevel,
            }
          : false,
      ),
    ])
    .default(false)
    .refine((toc) => (toc ? toc.minHeadingLevel <= toc.maxHeadingLevel : true), {
      message: 'minHeadingLevel must be less than or equal to maxHeadingLevel',
    });

// Images Collection
const imagesCollection = defineCollection({
  loader: async () => {
    const publicDirectory = path.join(process.cwd(), 'images');
    const imagePaths = await Glob(path.join(publicDirectory, '**/*.{jpg,jpeg,gif,svg,png,webp}'));
    const metas = imagePaths
      .map((imagePath) => imagePath.substring(process.cwd().length))
      .map(async (imagePath) => ({ id: imagePath, ...(await imageMetadata(imagePath)) }));

    return Promise.all(metas);
  },
  schema: z.object({
    src: z.string(),
    width: z.union([z.string(), z.number()]),
    height: z.union([z.string(), z.number()]),
    blurDataURL: z.string(),
    blurWidth: z.number(),
    blurHeight: z.number(),
  }),
});

// Albums Collection
const albumsCollection = defineCollection({
  loader: glob({ pattern: '**\/[^_]*.yml', base: './src/content/albums' }),
  schema: z.object({
    slug: slug(),
    title: z.string().max(99),
    date: z.date(),
    description: z.string().optional().describe('In markdown format'),
    cover: image(defaultCover),
    pictures: z
      .object({
        src: z.string(),
        title: z.string().optional(),
        description: z.string().optional().describe('In markdown format'),
        date: z.date(),
      })
      .array(),
  }),
});

// Categories Collection
const categoriesCollection = defineCollection({
  loader: file('./src/content/metas/categories.yml'),
  schema: z.object({
    name: z.string().max(20),
    slug: slug(),
    cover: image(defaultCover),
    description: z.string().max(999).optional().default('').describe('In markdown format'),
  }),
});

// Friends Collection
const friendsCollection = defineCollection({
  loader: file('./src/content/metas/friends.yml'),
  schema: z.object({
    website: z.string().max(40),
    description: z.string().optional().describe('One line string'),
    homepage: z.string().url(),
    poster: z
      .string()
      .transform((poster) => (poster.startsWith('/') ? urlJoin(options.assetsPrefix(), poster) : poster)),
  }),
});

// Tags Collection
const tagsCollection = defineCollection({
  loader: file('./src/content/metas/tags.yml'),
  schema: z.object({
    name: z.string().max(20),
    slug: slug(),
  }),
});

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
    cover: image(defaultCover),
    og: z.string().optional(),
    published: z.boolean().optional().default(true),
    visible: z.boolean().optional().default(true),
    toc: toc(),
  }),
});

// Pages Collection
const pagesCollection = defineCollection({
  loader: glob({ pattern: '**\/[^_]*.mdx', base: './src/content/pages' }),
  schema: z.object({
    title: z.string().max(99),
    date: z.date(),
    updated: z.date().optional(),
    comments: z.boolean().optional().default(true),
    cover: image(defaultCover),
    og: z.string().optional(),
    published: z.boolean().optional().default(true),
    summary: z.string().optional(),
    friend: z.boolean().optional().default(false),
    toc: toc(),
  }),
});

export const collections = {
  images: imagesCollection,
  albums: albumsCollection,
  categories: categoriesCollection,
  friends: friendsCollection,
  tags: tagsCollection,
  posts: postsCollection,
  pages: pagesCollection,
};
