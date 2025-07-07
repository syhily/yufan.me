/* eslint-disable antfu/no-top-level-await */
import type { RenderResult } from 'astro:content'
import type { Image } from '@/helpers/images'
import { getCollection, render } from 'astro:content'
import { pinyin } from 'pinyin-pro'
import { defaultCover } from '@/content.config'
import options from '@/options'
import { parseContent } from './markdown'

// Import the collections from the astro content.
const imagesCollection = await getCollection('images')
const albumsCollection = await getCollection('albums')
const friendsCollection = await getCollection('friends')
const pagesCollection = await getCollection('pages')
const postsCollection = await getCollection('posts')
const categoriesCollection = await getCollection('categories')
const tagsCollection = await getCollection('tags')

// Redefine the types from the astro content.
export type Picture = Omit<(typeof albumsCollection)[number]['data']['pictures'][number], 'src'> & Image
export type Album = Omit<(typeof albumsCollection)[number]['data'], 'cover' | 'pictures'> & {
  cover: Image
  pictures: Picture[]
}
export type Friend = (typeof friendsCollection)[number]['data']
export type Page = Omit<(typeof pagesCollection)[number]['data'], 'cover'> & {
  cover: Image
  slug: string
  permalink: string
  render: () => Promise<RenderResult>
}
export type Post = Omit<(typeof postsCollection)[number]['data'], 'cover'> & {
  cover: Image
  slug: string
  permalink: string
  render: () => Promise<RenderResult>
  raw: () => Promise<string | undefined>
}
export type Category = Omit<(typeof categoriesCollection)[number]['data'], 'cover'> & {
  cover: Image
  counts: number
  permalink: string
}
export type Tag = (typeof tagsCollection)[number]['data'] & { counts: number, permalink: string }

// Translate the Astro content into the original content for dealing with different configuration types.
const images: Array<Image & { id: string }> = imagesCollection.map(image => ({ id: image.id, ...image.data }))
export function getImage(src: string): Image {
  const image = images.find(image => image.id === src)
  if (image === undefined) {
    throw new Error(`The image ${src} doesn't exist on public directory`)
  }
  return image
}
export const albums: Album[] = albumsCollection.map(album => ({
  ...album.data,
  description: album.data.description,
  cover: getImage(album.data.cover),
  pictures: album.data.pictures.map(picture => ({ ...picture, ...getImage(picture.src) })),
}))
for (const album of albums) {
  if (album.description !== undefined && album.description !== '') {
    album.description = await parseContent(album.description)
  }
  for (const picture of album.pictures) {
    if (picture.description !== undefined && picture.description !== '') {
      picture.description = await parseContent(picture.description)
    }
  }
}
export const friends: Friend[] = friendsCollection.map(friends => friends.data)
export const pages: Page[] = pagesCollection
  .filter(page => page.data.published || !options.isProd())
  .map(page => ({
    ...page.data,
    cover: getImage(page.data.cover),
    slug: page.id,
    permalink: `/${page.id}`,
    render: async () => await render(page),
  }))
export const posts: Post[] = postsCollection
  .filter(post => post.data.published || !options.isProd())
  .map(post => ({
    ...post.data,
    cover: getImage(post.data.cover),
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
    return options.settings.post.sort === 'asc' ? a - b : b - a
  })
export const categories: Category[] = categoriesCollection.map(cat => ({
  ...cat.data,
  cover: getImage(cat.data.cover),
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

// Find the missing covers from posts.
const missingCovers = posts
  .filter(post => post.cover.src === defaultCover)
  .map(post => ({ title: post.title, slug: post.slug }))
if (!options.isProd() && missingCovers.length > 0) {
  // We only warn here for this is a known improvement.
  console.warn(`The following ${missingCovers.length} posts don't have a cover.`)
  console.warn(missingCovers)
}

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
const featurePosts: string[] = options.settings.post.feature ?? []
const invalidFeaturePosts = featurePosts.filter(slug => !postsSlugs.has(slug))
if (invalidFeaturePosts.length > 0) {
  throw new Error(`The bellowing feature posts are invalid:\n$${invalidFeaturePosts.join('\n')}`)
}

export function getAlbum(slug: string): Album | undefined {
  return albums.find(album => album.slug === slug)
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
