// Thin facade over `@/data/content/catalog`. The catalog is built exactly
// once here so existing call sites that expect synchronous accessors keep
// working. New code should prefer `await ContentCatalog.get()` directly when
// it lives in an async context, which lets us eventually drop this top-level
// await entirely.

import { ContentCatalog } from '@/data/content/catalog'

export type { Category, Friend, LoadPostsOptions, Page, Post, Tag } from '@/data/content/catalog'

import type { Category, LoadPostsOptions, Page, Post, Tag } from '@/data/content/catalog'

const catalog = await ContentCatalog.get()

export const friends = catalog.friends
export const pages = catalog.pages
export const categories = catalog.categories
export const tags = catalog.tags

export function getPosts(options: LoadPostsOptions): Post[] {
  return catalog.getPosts(options)
}

export interface LoadPostsWithMetadataOptions {
  likes: boolean
  views: boolean
  comments: boolean
}

export type PostWithMetadata = Post & { meta: PostMetadata }

export interface PostMetadata {
  likes: number
  views: number
  comments: number
}

import { queryMetadata } from '@/helpers/comment/likes'

export async function getPostsWithMetadata(
  posts: Post[],
  options: LoadPostsWithMetadataOptions,
): Promise<PostWithMetadata[]> {
  if (posts.length === 0) {
    return []
  }
  const metas = await queryMetadata(
    posts.map((post) => post.permalink),
    options,
  )
  return posts.map((post) => {
    const meta = metas.get(post.permalink) ?? { likes: 0, views: 0, comments: 0 }
    return { ...post, meta }
  })
}

export function getPost(slug: string): Post | undefined {
  return catalog.getPost(slug)
}

export function getPage(slug: string): Page | undefined {
  return catalog.getPage(slug)
}

export function getCategory(name?: string, slug?: string): Category | undefined {
  return catalog.getCategory(name, slug)
}

export function getTag(name?: string, slug?: string): Tag | undefined {
  return catalog.getTag(name, slug)
}
