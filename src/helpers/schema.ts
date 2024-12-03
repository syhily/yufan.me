import { defaultCover } from '@/content.config';
import type { Image } from '@/helpers/images';
import options from '@/options';
import { getCollection, getEntry, render, type RenderResult } from 'astro:content';
import { pinyin } from 'pinyin-pro';

// Import the collections from the astro content.
const imagesCollection = await getCollection('images');
const categoriesCollection = await getCollection('categories');
const friendsCollection = await getCollection('friends');
const pagesCollection = await getCollection('pages');
const postsCollection = await getCollection('posts');
const tagsCollection = await getCollection('tags');

// Redefine the types from the astro content.
export type Category = Omit<(typeof categoriesCollection)[number]['data'], 'cover'> & {
  cover: Image;
  counts: number;
  permalink: string;
};
export type Friend = (typeof friendsCollection)[number]['data'][number];
export type Page = Omit<(typeof pagesCollection)[number]['data'], 'cover'> & {
  cover: Image;
  slug: string;
  permalink: string;
  render: () => Promise<RenderResult>;
};
export type Post = Omit<(typeof postsCollection)[number]['data'], 'cover'> & {
  cover: Image;
  slug: string;
  permalink: string;
  render: () => Promise<RenderResult>;
  raw: () => Promise<string | undefined>;
};
export type Tag = (typeof tagsCollection)[number]['data'][number] & { counts: number; permalink: string };

// Translate the Astro content into the original content for dealing with different configuration types.
export const friends: Friend[] = friendsCollection.flatMap((friends) => friends.data);

// Override the website for local debugging
export const pages: Page[] = await Promise.all(
  pagesCollection
    .filter((page) => page.data.published || !options.isProd())
    .map(async (page) => ({
      ...page.data,
      cover: (await getEntry('images', page.data.cover)).data,
      slug: page.id,
      permalink: `/${page.id}`,
      render: async () => await render(await getEntry('pages', page.id)),
    })),
);
export const posts: Post[] = (
  await Promise.all(
    postsCollection
      .filter((post) => post.data.published || !options.isProd())
      .map(async (post) => ({
        ...post.data,
        cover: (await getEntry('images', post.data.cover)).data,
        slug: post.id,
        permalink: `/posts/${post.id}`,
        render: async () => await render(await getEntry('posts', post.id)),
        raw: async () => {
          const entry = await getEntry('posts', post.id);
          return entry.body;
        },
      })),
  )
).sort((left: Post, right: Post) => {
  const a = left.date.getTime();
  const b = right.date.getTime();
  return options.settings.post.sort === 'asc' ? a - b : b - a;
});
export const categories: Category[] = await Promise.all(
  categoriesCollection.map(async (cat) => ({
    ...cat.data,
    cover: (await getEntry('images', cat.data.cover)).data,
    counts: posts.filter((post) => post.category === cat.data.name).length,
    permalink: `/cats/${cat.data.slug}`,
  })),
);
export const tags: Tag[] = tagsCollection.flatMap((tags) => {
  return tags.data.map((tag) => ({
    counts: posts.filter((post) => post.tags.includes(tag.name)).length,
    permalink: `/tags/${tag.slug}`,
    ...tag,
  }));
});

// Find the missing categories from posts.
const missingCategories: string[] = posts
  .map((post) => post.category)
  .filter((c) => !categories.find((cat) => cat.name === c));
if (missingCategories.length > 0) {
  throw new Error(`The bellowing categories has not been configured:\n$${missingCategories.join('\n')}`);
}

// Find the missing tags from posts.
const missingTags: string[] = posts.flatMap((post) => post.tags).filter((tag) => !tags.find((t) => t.name === tag));
if (missingTags.length > 0) {
  console.warn(`The bellowing tags has not been configured:\n${missingTags.join('\n')}`);
  for (const missingTag of missingTags) {
    const slug = pinyin(missingTag, { toneType: 'none', separator: '-', nonZh: 'consecutive', type: 'string' })
      .replaceAll(' ', '-')
      .toLowerCase();
    tags.push({
      name: missingTag,
      slug: slug,
      permalink: `/tags/${slug}`,
      counts: posts.filter((post) => post.tags.includes(missingTag)).length,
    });
  }
}

// Find the missing covers from posts.
const missingCovers = posts
  .filter((post) => post.cover.src === defaultCover)
  .map((post) => ({ title: post.title, slug: post.slug }));
if (!options.isProd() && missingCovers.length > 0) {
  // We only warn here for this is a known improvement.
  console.warn(`The following ${missingCovers.length} posts don't have a cover.`);
  console.warn(missingCovers);
}

// Validate the posts and pages' slug and alias. They should be unique globally.
const postsSlugs = new Set<string>();
for (const post of posts) {
  if (postsSlugs.has(post.slug)) {
    throw new Error(`Duplicate post slug: ${post.slug}`);
  }
  postsSlugs.add(post.slug);

  for (const alias of post.alias) {
    if (postsSlugs.has(alias)) {
      throw new Error(`Duplicate alias ${alias} in post ${post.slug}`);
    }

    postsSlugs.add(alias);
  }
}
for (const page of pages) {
  if (postsSlugs.has(page.slug)) {
    throw new Error(`Page and post share same slug: ${page.slug}`);
  }
}

// Validate feature posts option.
const featurePosts: string[] = options.settings.post.feature ?? [];
const invalidFeaturePosts = featurePosts.filter((slug) => !postsSlugs.has(slug));
if (invalidFeaturePosts.length > 0) {
  throw new Error(`The bellowing feature posts are invalid:\n$${invalidFeaturePosts.join('\n')}`);
}

export const getPost = (slug: string): Post | undefined => {
  return posts.find((post) => post.slug === slug);
};

export const getPage = (slug: string): Page | undefined => {
  return pages.find((page) => page.slug === slug);
};

export const getCategory = (name?: string, slug?: string): Category | undefined => {
  return categories.find((c) => c.name === name || c.slug === slug);
};

export const getTag = (name?: string, slug?: string): Tag | undefined => {
  return tags.find((tag) => tag.name === name || tag.slug === slug);
};
