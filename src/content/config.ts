import { defineCollection, z } from 'astro:content';

// Copied from https://github.com/zce/velite/blob/main/src/schemas/isodate.ts
const isodate = () =>
  z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date string')
    .transform<string>((value) => new Date(value).toISOString());

const slugCache = new Set<string>();

// Copied and modified from https://github.com/zce/velite/blob/main/src/schemas/slug.ts
const slug = (by: string, reserved: string[] = []) =>
  z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Invalid slug')
    .refine((value) => !reserved.includes(value), 'Reserved slug')
    .superRefine((value, { addIssue }) => {
      const key = `${by}:${value}`;
      if (slugCache.has(key)) {
        addIssue({
          fatal: true,
          code: 'custom',
          message: `duplicate slug '${value}' in category '${by}'`,
        });
      } else {
        slugCache.add(key);
      }
    });

const postsCollection = defineCollection({
  type: 'content',
  schema: z
    .object({
      title: z.string().max(99),
      slug: slug('posts', ['admin', 'login']),
      date: isodate(),
      updated: isodate().optional(),
      comments: z.boolean().optional().default(true),
      tags: z.array(z.string()).optional().default([]),
      category: z.string(),
      summary: z.string().optional().default(''),
      cover: z.string().optional().default('/images/default-cover.jpg'),
      published: z.boolean().optional().default(true),
    })
    .transform((data) => ({ ...data, permalink: `/posts/${data.slug}` })),
});

export const collections = {
  posts: postsCollection,
};
