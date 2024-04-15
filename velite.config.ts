import { join } from 'node:path';

import rehypePrettyCode from 'rehype-pretty-code';
import { defineCollection, defineConfig, s } from 'velite';

import { nextImage } from '@/components/mdx/remark-plugins';

// Custom Field Types
const mdx = s.mdx({
  gfm: true,
  removeComments: true,
  copyLinkedFiles: false,
  remarkPlugins: [nextImage],
  rehypePlugins: [
    [
      rehypePrettyCode,
      {
        theme: 'solarized-light',
      },
    ],
  ],
});

const assertRoot = join(process.cwd(), '/public');

// Option Types
const options = defineCollection({
  name: 'Options',
  pattern: 'options/index.yml',
  single: true,
  schema: s.object({
    title: s.string().max(99),
    website: s.string().url(),
    description: s.string().max(999),
    keywords: s.array(s.string()),
    author: s.object({ name: s.string(), email: s.string().email(), url: s.string().url() }),
    navigation: s.array(s.object({ text: s.string(), link: s.string(), target: s.string().optional() })),
    socials: s.array(
      s.object({
        name: s.string(),
        icon: s.string(),
        type: s.enum(['link', 'qrcode']),
        title: s.string().optional(),
        link: s.string().url(),
      }),
    ),
    settings: s.object({
      initialYear: s.number().max(2024),
      icpNo: s.string().optional(),
      locale: s.string().optional().default('zh-CN'),
      timeZone: s.string().optional().default('Asia/Shanghai'),
      timeFormat: s.string().optional().default('yyyy-MM-dd HH:mm:ss'),
      post: s.object({
        sort: s.enum(['asc', 'desc']),
        feature: s.array(s.string()).optional(),
        category: s.array(s.string()).optional(),
      }),
      pagination: s.object({
        posts: s.number().optional().default(5),
        category: s.number().optional().default(7),
        tags: s.number().optional().default(7),
        search: s.number().optional().default(7),
      }),
      feed: s.object({
        full: s.boolean().optional().default(true),
        size: s.number().optional().default(20),
      }),
      sidebar: s.object({
        search: s.boolean().default(false),
        post: s.number().default(6),
        comment: s.number().default(0),
        tag: s.number().default(20),
      }),
      comments: s.object({
        server: s.string().url().readonly(),
        admins: s.array(s.number()).readonly(),
      }),
    }),
  }),
});

// Category Types
const categories = defineCollection({
  name: 'Category',
  pattern: 'categories/*.yml',
  schema: s
    .object({
      name: s.string().max(20),
      slug: s.slug('category'),
      cover: s.image({ absoluteRoot: assertRoot }),
      description: s.string().max(999).optional(),
      count: s.number().default(0),
    })
    .transform((data) => ({ ...data, permalink: `/cats/${data.slug}` })),
});

// Friend Types
const friends = defineCollection({
  name: 'Friend',
  pattern: 'options/friends.yml',
  schema: s.object({
    website: s.string().max(40),
    description: s.string().optional(),
    homepage: s.string().url(),
    poster: s.image({ absoluteRoot: assertRoot }),
  }),
});

// Tags Types
const tags = defineCollection({
  name: 'Tag',
  pattern: 'tags/index.yml',
  schema: s
    .object({
      name: s.string().max(20),
      slug: s.slug('tag'),
      description: s.string().max(999).optional(),
      count: s.number().default(0),
    })
    .transform((data) => ({ ...data, permalink: `/tags/${data.slug}` })),
});

// Post Types
const posts = defineCollection({
  name: 'Post',
  pattern: 'posts/**/*.mdx',
  schema: s
    .object({
      title: s.string().max(99),
      slug: s.slug('posts', ['admin', 'login']),
      date: s.isodate(),
      updated: s.isodate().optional(),
      comments: s.boolean().optional().default(true),
      tags: s.array(s.string()).optional().default([]),
      category: s.string(),
      summary: s.string().optional().default(''),
      cover: s.image({ absoluteRoot: assertRoot }).optional().default('/images/default-cover.jpg'),
      published: s.boolean().optional().default(true),
      excerpt: s.excerpt(),
      meta: s.metadata(),
      toc: s.toc(),
      raw: s.raw(),
      content: mdx,
    })
    .transform((data) => ({ ...data, permalink: `/posts/${data.slug}` })),
});

// Page Types
const pages = defineCollection({
  name: 'Page',
  pattern: 'pages/*.mdx',
  schema: s
    .object({
      title: s.string().max(99),
      slug: s.slug('global', ['admin', 'login', 'cats', 'page', 'tags']),
      date: s.isodate(),
      updated: s.isodate().optional(),
      comments: s.boolean().optional().default(true),
      cover: s.image({ absoluteRoot: assertRoot }).optional().default('/images/default-cover.jpg'),
      published: s.boolean().optional().default(true),
      friend: s.boolean().optional().default(false),
      excerpt: s.excerpt(),
      meta: s.metadata(),
      toc: s.toc(),
      raw: s.raw(),
      content: mdx,
    })
    .transform((data) => ({ ...data, permalink: `/${data.slug}` })),
});

// Define all the available content formats.
export default defineConfig({
  strict: true,
  root: 'content',
  output: {
    data: '.velite',
    clean: true,
    assets: 'public',
  },
  collections: {
    options: options,
    categories: categories,
    tags: tags,
    posts: posts,
    pages: pages,
    friends: friends,
  },
  markdown: { rehypePlugins: [[rehypePrettyCode, { theme: 'solarized-light' }]] },
  prepare: async (collections: any) => {
    const { categories, tags, posts, options, pages } = collections;
    // Some service provider, like vercel will set this environment automatically.
    // But you need to pay more attention on the SaaS platforms that didn't implicit set this for you.
    // For instance, Zeabur.
    const publishedPosts: any[] = posts.filter((post: any) => process.env.NODE_ENV !== 'production' || post.published);
    const publishedPages: any[] = pages.filter((page: any) => process.env.NODE_ENV !== 'production' || page.published);

    // Find missing categories, tags from posts.
    const missingCategories: string[] = publishedPosts
      .map((post: any) => post.category)
      .filter((c: any) => !categories.find((i: any) => i.name === c));
    if (missingCategories.length > 0) {
      console.error('The bellowing categories has not been configured:');
      console.error(missingCategories);
    }

    const missingTags: string[] = publishedPosts
      .flatMap((post: any) => post.tags)
      .filter((tag) => !tags.find((t: any) => t.name === tag));
    if (missingTags.length > 0) {
      console.error('The bellowing tags has not been configured:');
      console.error(missingTags);
    }

    // Find the missing covers for posts.
    const missingCovers = publishedPosts
      .filter((post: any) => post.cover.src === '/images/default-cover.jpg')
      .map((post: any) => ({ title: post.title, slug: post.slug }));
    if (process.env.NODE_ENV !== 'production' && missingCovers.length > 0) {
      console.warn(`The following ${missingCovers.length} posts don't have a cover.`);
      console.warn(missingCovers);
    }

    // Count tags and categories.
    categories.forEach((i: any) => {
      i.count = posts.filter((j: any) => j.category === i.name).length;
    });

    tags.forEach((i: any) => {
      i.count = posts.filter((j: any) => j.tags.includes(i.name)).length;
    });

    // Validate feature posts option.
    const featurePosts: string[] = options.settings.post.feature ?? [];
    const slugs = publishedPosts.map((post: any) => post.slug as string);
    const invalidFeaturePosts = featurePosts.filter((slug) => !slugs.includes(slug));
    if (invalidFeaturePosts.length > 0) {
      console.error('The bellowing feature posts are invalid');
      console.error(invalidFeaturePosts);
    }

    // Validate pinned categories.
    const pinnedCategories: string[] = options.settings.post.category ?? [];
    const invalidPinnedCategories = pinnedCategories.filter((c) => categories.find((e: any) => e.name === c));
    if (invalidPinnedCategories.length > 0) {
      console.error('The bellowing pinned categories are invalid');
      console.error(invalidPinnedCategories);
    }

    // Sort the posts.
    const sortedPosts = publishedPosts.sort((left: any, right: any) => {
      const a = new Date(left.date).getTime();
      const b = new Date(right.date).getTime();
      return options.settings.post.sort === 'asc' ? a - b : b - a;
    });

    // Update the result collections
    Object.assign(collections, {
      posts: sortedPosts,
      pages: publishedPages,
      options: options,
      tags: tags,
      categories: categories,
    });
  },
});
