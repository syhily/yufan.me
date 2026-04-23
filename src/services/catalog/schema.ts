// Async-first catalog facade.
//
// Earlier this file did `const catalog = await ContentCatalog.get()` at the
// top level so consumers could call `getPost(slug)` synchronously. That kept
// every importer simple but dragged the whole catalog into module init,
// which means **every** entry that transitively imports this file pays the
// catalog cost up front and import ordering becomes hard to reason about.
//
// All the public accessors are now async. ContentCatalog itself memoizes
// the build, so the cost is identical after the first call — but we no
// longer pin everyone to top-level await.

import { ContentCatalog } from '@/services/catalog'

export type { Category, Friend, LoadPostsOptions, Page, Post, Tag } from '@/services/catalog'

import type { Category, LoadPostsOptions, Page, Post, Tag } from '@/services/catalog'

import { queryMetadata } from '@/services/comments/likes'

const catalog = (): Promise<ContentCatalog> => ContentCatalog.get()

// Async accessors — preferred entry point for all new code.

export async function getFriends() {
  return (await catalog()).friends
}

export async function getPages(): Promise<Page[]> {
  return (await catalog()).pages
}

export async function getCategories(): Promise<Category[]> {
  return (await catalog()).categories
}

export async function getTags(): Promise<Tag[]> {
  return (await catalog()).tags
}

export async function getPosts(options: LoadPostsOptions): Promise<Post[]> {
  return (await catalog()).getPosts(options)
}

export async function getPost(slug: string): Promise<Post | undefined> {
  return (await catalog()).getPost(slug)
}

export async function getPage(slug: string): Promise<Page | undefined> {
  return (await catalog()).getPage(slug)
}

export async function getCategory(name?: string, slug?: string): Promise<Category | undefined> {
  return (await catalog()).getCategory(name, slug)
}

export async function getTag(name?: string, slug?: string): Promise<Tag | undefined> {
  return (await catalog()).getTag(name, slug)
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
