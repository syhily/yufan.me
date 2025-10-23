import type { RenderResult } from 'astro:content'
import { getCollection, render } from 'astro:content'
import { pinyin } from 'pinyin-pro'
import config from '@/blog.config'
import { queryMetadata } from '@/helpers/comment/likes'
import { parseContent } from '@/helpers/content/markdown'

// Import the collections from the astro content.
const friendsCollection = await getCollection('friends')
const pagesCollection = await getCollection('pages')
const postsCollection = await getCollection('posts')
const categoriesCollection = await getCollection('categories')
const tagsCollection = await getCollection('tags')
const imageCollection = await getCollection('images')

// Redefine the types from the astro content.
export type Friend = (typeof friendsCollection)[number]['data']
export type Page = Omit<(typeof pagesCollection)[number]['data'], 'cover'> & {
  cover: string
  slug: string
  permalink: string
  render: () => Promise<RenderResult>
}
export type Post = Omit<(typeof postsCollection)[number]['data'], 'cover'> & {
  cover: string
  slug: string
  permalink: string
  render: () => Promise<RenderResult>
  raw: () => Promise<string | undefined>
}
export type Category = Omit<(typeof categoriesCollection)[number]['data'], 'cover'> & {
  cover: string
  counts: number
  permalink: string
}
export type Tag = (typeof tagsCollection)[number]['data'] & { counts: number, permalink: string }
export type Image = Omit<(typeof imageCollection)[number]['data'], 'id'>

export const friends: Friend[] = friendsCollection.map(friends => friends.data)
export const pages: Page[] = pagesCollection
  .filter(page => page.data.published || !import.meta.env.PROD)
  .map(page => ({
    ...page.data,
    slug: page.id,
    permalink: `/${page.id}`,
    render: async () => await render(page),
  }))
const posts: Post[] = postsCollection
  .filter(post => post.data.published || !import.meta.env.PROD)
  .map(post => ({
    ...post.data,
    cover: post.data.cover ?? '',
    slug: post.id,
    permalink: `/posts/${post.id}`,
    render: async () => await render(post),
    raw: async () => {
      return post.body
    },
  }))
  .sort((left: Post, right: Post) => {
    const a = left.date.getTime()
    const b = right.date.getTime()
    return config.settings.post.sort === 'asc' ? a - b : b - a
  })
export const categories: Category[] = categoriesCollection.map(cat => ({
  ...cat.data,
  counts: posts.filter(post => post.category === cat.data.name).length,
  permalink: `/cats/${cat.data.slug}`,
}))
for (const category of categories) {
  if (category.description !== '') {
    category.description = await parseContent(category.description)
  }
}
export const tags: Tag[] = tagsCollection.map(tag => ({
  ...tag.data,
  counts: posts.filter(post => post.tags.includes(tag.data.name)).length,
  permalink: `/tags/${tag.data.slug}`,
}))

// Find the missing categories from posts.
const missingCategories: string[] = posts
  .map(post => post.category)
  .filter(c => !categories.find(cat => cat.name === c))
if (missingCategories.length > 0) {
  throw new Error(`The bellowing categories has not been configured:\n$${missingCategories.join('\n')}`)
}

// Find the missing tags from posts.
const missingTags: string[] = posts.flatMap(post => post.tags).filter(tag => !tags.find(t => t.name === tag))
if (missingTags.length > 0) {
  console.warn(`The bellowing tags has not been configured:\n${missingTags.join('\n')}`)
  for (const missingTag of missingTags) {
    const slug = pinyin(missingTag, { toneType: 'none', separator: '-', nonZh: 'consecutive', type: 'string' })
      .replaceAll(' ', '-')
      .toLowerCase()
    tags.push({
      name: missingTag,
      slug,
      permalink: `/tags/${slug}`,
      counts: posts.filter(post => post.tags.includes(missingTag)).length,
    })
  }
}

// Set the default cover for posts without cover.
posts
  .filter(post => post.cover === '')
  .forEach((post) => {
    const cat = categories.find(cat => cat.name === post.category)
    if (cat !== undefined) {
      post.cover = cat.cover
    }
  })

// Validate the posts and pages' slug and alias. They should be unique globally.
const postsSlugs = new Set<string>()
for (const post of posts) {
  if (postsSlugs.has(post.slug)) {
    throw new Error(`Duplicate post slug: ${post.slug}`)
  }
  postsSlugs.add(post.slug)

  for (const alias of post.alias) {
    if (postsSlugs.has(alias)) {
      throw new Error(`Duplicate alias ${alias} in post ${post.slug}`)
    }

    postsSlugs.add(alias)
  }
}
for (const page of pages) {
  if (postsSlugs.has(page.slug)) {
    throw new Error(`Page and post share same slug: ${page.slug}`)
  }
}

// Validate feature posts option.
const featurePosts: string[] = config.settings.post.feature ?? []
const invalidFeaturePosts = featurePosts.filter(slug => !postsSlugs.has(slug))
if (invalidFeaturePosts.length > 0) {
  throw new Error(`The bellowing feature posts are invalid:\n$${invalidFeaturePosts.join('\n')}`)
}

export interface LoadPostsOptions {
  hidden: boolean
  schedule: boolean
}

export function getPosts(options: LoadPostsOptions): Post[] {
  return posts.filter(post => post.visible || options.hidden).filter(post => post.date <= new Date() || options.schedule)
}

export interface LoadPostsWithMetadataOptions {
  likes: boolean
  views: boolean
  comments: boolean
}

export type PostWithMetadata = Post & {
  meta: PostMetadata
}

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
  const metas = await queryMetadata(posts.map(post => post.permalink), options)
  return posts.map((post) => {
    const meta = metas.get(post.permalink) ?? { likes: 0, views: 0, comments: 0 }
    return { ...post, meta }
  })
}

export function getPost(slug: string): Post | undefined {
  return posts.find(post => post.slug === slug)
}

export function getPage(slug: string): Page | undefined {
  return pages.find(page => page.slug === slug)
}

export function getCategory(name?: string, slug?: string): Category | undefined {
  return categories.find(c => c.name === name || c.slug === slug)
}

export function getTag(name?: string, slug?: string): Tag | undefined {
  return tags.find(tag => tag.name === name || tag.slug === slug)
}

// Query the image metadata from the image collection.
const imageUrlPrefix = `${config.settings.asset.scheme}://${config.settings.asset.host}`
export function getImageMetadata(source: string): Image | undefined {
  const requestPath = source.startsWith(imageUrlPrefix) ? source.substring(imageUrlPrefix.length) : source
  return imageCollection.find(img => img.id === requestPath)?.data
}
