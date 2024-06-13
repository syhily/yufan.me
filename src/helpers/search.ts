import { posts } from '@/helpers/schema';
import Fuse from 'fuse.js';

interface PostItem {
  title: string;
  slug: string;
  raw: string;
  tags: string[];
}

const allPosts = await Promise.all(
  posts.map(async (post) => ({
    title: post.title,
    slug: post.slug,
    raw: await post.raw(),
    tags: post.tags,
  })),
);
const indexes = Fuse.createIndex<PostItem>(['title', 'raw', 'tags'], allPosts);
const search = new Fuse<PostItem>(allPosts, { includeScore: true, keys: ['title', 'raw', 'tags'] }, indexes);

export const searchPosts = (query: string): string[] => search.search<PostItem>(query).map((post) => post.item.slug);
