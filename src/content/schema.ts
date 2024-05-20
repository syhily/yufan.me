import { getCollection, getEntryBySlug, type Render } from 'astro:content';

// Import the collections from the astro content.
const categoriesCollection = await getCollection('categories');
const friendsCollection = await getCollection('friends');
const optionsCollection = await getCollection('options');
const pagesCollection = await getCollection('pages');
const postsCollection = await getCollection('posts');
const tagsCollection = await getCollection('tags');

// Redefine the types from the astro content.
type Category = (typeof categoriesCollection)[number]['data'] & { counts: number; permalink: string };
type Friend = (typeof friendsCollection)[number]['data'][number];
type Options = (typeof optionsCollection)[number]['data'];
type Page = (typeof pagesCollection)[number]['data'] & {
  slug: string;
  permalink: string;
  render: () => Render['.mdx'];
};
type Post = (typeof postsCollection)[number]['data'] & {
  slug: string;
  permalink: string;
  render: () => Render['.mdx'];
};
type Tag = (typeof tagsCollection)[number]['data'][number] & { counts: number; permalink: string };

// Export all the types.
export type { Category, Friend, Options, Page, Post, Tag };

// Translate the Astro content into the original content for dealing with different configuration types.
const friends: Friend[] = friendsCollection[0].data;

const options: Options = optionsCollection[0].data;

const pages: Page[] = pagesCollection.map((page) => ({
  slug: page.slug,
  permalink: `/${page.slug}`,
  render: async () => {
    const entry = await getEntryBySlug('pages', page.slug);
    return entry.render();
  },
  ...page.data,
}));

const posts: Post[] = postsCollection.map((post) => ({
  slug: post.slug,
  permalink: `/posts/${post.slug}`,
  render: async () => {
    const entry = await getEntryBySlug('posts', post.slug);
    return entry.render();
  },
  ...post.data,
}));

const categories: Category[] = categoriesCollection.map((cat) => ({
  counts: posts.filter((post) => post.category === cat.data.name).length,
  permalink: `/cats/${cat.data.slug}`,
  ...cat.data,
}));

const tags: Tag[] = tagsCollection[0].data.map((tag) => ({
  counts: posts.filter((post) => post.tags.includes(tag.name)).length,
  permalink: `/tags/${tag.slug}`,
  ...tag,
}));

export { friends, options, pages, posts, categories, tags };

export const getPost = (slug: string): Post | undefined => {
  return posts.find((post) => post.slug === slug);
};

export const getPage = (slug: string): Page | undefined => {
  return pages.find((page) => page.slug === slug);
};
