import type { RenderResult } from 'astro:content'

import { getCollection, render } from 'astro:content'
import { pinyin } from 'pinyin-pro'

import config from '@/blog.config'
import { parseContent } from '@/services/markdown/parser'
import { getLogger } from '@/shared/logger'

const log = getLogger('content.catalog')

// -----------------------------------------------------------------------------
// Public domain types. Kept here so the rest of the codebase only needs to
// import from `@/data/content/catalog` (or the helper facade in
// `@/helpers/content/schema`).
// -----------------------------------------------------------------------------

type FriendsCollection = Awaited<ReturnType<typeof getCollection<'friends'>>>
type PagesCollection = Awaited<ReturnType<typeof getCollection<'pages'>>>
type PostsCollection = Awaited<ReturnType<typeof getCollection<'posts'>>>
type CategoriesCollection = Awaited<ReturnType<typeof getCollection<'categories'>>>
type TagsCollection = Awaited<ReturnType<typeof getCollection<'tags'>>>

export type Friend = FriendsCollection[number]['data']

export type Page = Omit<PagesCollection[number]['data'], 'cover'> & {
  cover: string
  slug: string
  permalink: string
  render: () => Promise<RenderResult>
}

export type Post = Omit<PostsCollection[number]['data'], 'cover'> & {
  cover: string
  slug: string
  permalink: string
  render: () => Promise<RenderResult>
  raw: () => Promise<string | undefined>
}

export type Category = Omit<CategoriesCollection[number]['data'], 'cover'> & {
  cover: string
  counts: number
  permalink: string
}

export type Tag = TagsCollection[number]['data'] & { counts: number; permalink: string }

export interface LoadPostsOptions {
  hidden: boolean
  schedule: boolean
}

// -----------------------------------------------------------------------------
// ContentCatalog — single source of truth for derived content data.
//
// We expose synchronous getters because almost every consumer (Astro pages,
// components, feed builders) treats the catalog as an in-memory dataset; the
// previous implementation in `helpers/content/schema.ts` did exactly the same
// using a top-level `await getCollection(...)`. The catalog keeps the same
// trade-off but adds:
//   - O(1) lookup tables (`Map<slug, Post>`, `Map<name|slug, Category>`...)
//   - `publicPosts` / `allPosts` precomputed slices so list pages don't have
//     to re-filter on every render.
//   - A clearly named `build()` entry point so tests can construct ad-hoc
//     catalogs without crawling Astro's content layer.
// -----------------------------------------------------------------------------

export class ContentCatalog {
  private static instance: Promise<ContentCatalog> | null = null

  static get(): Promise<ContentCatalog> {
    if (this.instance === null) {
      this.instance = this.build()
    }
    return this.instance
  }

  static reset(): void {
    this.instance = null
  }

  static async build(): Promise<ContentCatalog> {
    const friendsCollection = await getCollection('friends')
    const pagesCollection = await getCollection('pages')
    const postsCollection = await getCollection('posts')
    const categoriesCollection = await getCollection('categories')
    const tagsCollection = await getCollection('tags')

    const friends: Friend[] = friendsCollection.map((f) => f.data)

    const pages: Page[] = pagesCollection
      .filter((page) => page.data.published || !import.meta.env.PROD)
      .map((page) => ({
        ...page.data,
        slug: page.id,
        permalink: `/${page.id}`,
        render: async () => render(page),
      }))

    const allPosts: Post[] = postsCollection
      .filter((post) => post.data.published || !import.meta.env.PROD)
      .map((post) => ({
        ...post.data,
        cover: post.data.cover ?? '',
        slug: post.id,
        permalink: `/posts/${post.id}`,
        render: async () => render(post),
        raw: async () => post.body,
      }))
      .sort((left, right) => {
        const a = left.date.getTime()
        const b = right.date.getTime()
        return config.settings.post.sort === 'asc' ? a - b : b - a
      })

    const categories: Category[] = categoriesCollection.map((cat) => ({
      ...cat.data,
      counts: allPosts.filter((post) => post.category === cat.data.name).length,
      permalink: `/cats/${cat.data.slug}`,
    }))
    for (const category of categories) {
      if (category.description !== '') {
        category.description = await parseContent(category.description)
      }
    }

    const tags: Tag[] = tagsCollection.map((tag) => ({
      ...tag.data,
      counts: allPosts.filter((post) => post.tags.includes(tag.data.name)).length,
      permalink: `/tags/${tag.data.slug}`,
    }))

    // Verify that every post category was declared in the categories
    // collection. We surface this as a hard error to fail builds early.
    const missingCategories: string[] = allPosts
      .map((post) => post.category)
      .filter((c) => !categories.find((cat) => cat.name === c))
    if (missingCategories.length > 0) {
      throw new Error(`The bellowing categories has not been configured:\n${missingCategories.join('\n')}`)
    }

    // Auto-derive any missing tag definitions from the posts themselves so
    // that a typo doesn't break the whole site (we only warn).
    const missingTags: string[] = allPosts
      .flatMap((post) => post.tags)
      .filter((tag) => !tags.find((t) => t.name === tag))
    if (missingTags.length > 0) {
      log.warn('auto-deriving missing tag definitions', { missing: missingTags })
      for (const missingTag of missingTags) {
        const slug = pinyin(missingTag, {
          toneType: 'none',
          separator: '-',
          nonZh: 'consecutive',
          type: 'string',
        })
          .replaceAll(' ', '-')
          .toLowerCase()
        tags.push({
          name: missingTag,
          slug,
          permalink: `/tags/${slug}`,
          counts: allPosts.filter((post) => post.tags.includes(missingTag)).length,
        })
      }
    }

    // Default cover from the post's category when explicit cover is missing.
    for (const post of allPosts) {
      if (post.cover === '') {
        const cat = categories.find((cat) => cat.name === post.category)
        if (cat !== undefined) {
          post.cover = cat.cover
        }
      }
    }

    // Slug uniqueness validation (+ alias) and feature post sanity check.
    const postsSlugs = new Set<string>()
    const bySlug = new Map<string, Post>()
    const byAlias = new Map<string, Post>()
    for (const post of allPosts) {
      if (postsSlugs.has(post.slug)) {
        throw new Error(`Duplicate post slug: ${post.slug}`)
      }
      postsSlugs.add(post.slug)
      bySlug.set(post.slug, post)
      for (const alias of post.alias) {
        if (postsSlugs.has(alias)) {
          throw new Error(`Duplicate alias ${alias} in post ${post.slug}`)
        }
        postsSlugs.add(alias)
        byAlias.set(alias, post)
      }
    }
    for (const page of pages) {
      if (postsSlugs.has(page.slug)) {
        throw new Error(`Page and post share same slug: ${page.slug}`)
      }
    }
    const featurePosts: string[] = config.settings.post.feature ?? []
    const invalidFeaturePosts = featurePosts.filter((slug) => !postsSlugs.has(slug))
    if (invalidFeaturePosts.length > 0) {
      throw new Error(`The bellowing feature posts are invalid:\n${invalidFeaturePosts.join('\n')}`)
    }

    // Pre-compute the most common slice (visible AND already published) so
    // list pages don't need to filter the full array on every render.
    const now = new Date()
    const publicPosts = allPosts.filter((post) => post.visible && post.date <= now)

    const pageBySlug = new Map<string, Page>()
    for (const page of pages) pageBySlug.set(page.slug, page)

    const categoryByName = new Map<string, Category>()
    const categoryBySlug = new Map<string, Category>()
    for (const cat of categories) {
      categoryByName.set(cat.name, cat)
      categoryBySlug.set(cat.slug, cat)
    }

    const tagByName = new Map<string, Tag>()
    const tagBySlug = new Map<string, Tag>()
    for (const tag of tags) {
      tagByName.set(tag.name, tag)
      tagBySlug.set(tag.slug, tag)
    }

    return new ContentCatalog({
      friends,
      pages,
      allPosts,
      publicPosts,
      categories,
      tags,
      bySlug,
      byAlias,
      pageBySlug,
      categoryByName,
      categoryBySlug,
      tagByName,
      tagBySlug,
    })
  }

  readonly friends: Friend[]
  readonly pages: Page[]
  /** Every post that survived the `published` filter. */
  readonly allPosts: Post[]
  /** Subset of allPosts where `visible` is true and `date <= now`. */
  readonly publicPosts: Post[]
  readonly categories: Category[]
  readonly tags: Tag[]

  private readonly bySlug: Map<string, Post>
  private readonly byAlias: Map<string, Post>
  private readonly pageBySlug: Map<string, Page>
  private readonly categoryByName: Map<string, Category>
  private readonly categoryBySlug: Map<string, Category>
  private readonly tagByName: Map<string, Tag>
  private readonly tagBySlug: Map<string, Tag>

  private constructor(input: {
    friends: Friend[]
    pages: Page[]
    allPosts: Post[]
    publicPosts: Post[]
    categories: Category[]
    tags: Tag[]
    bySlug: Map<string, Post>
    byAlias: Map<string, Post>
    pageBySlug: Map<string, Page>
    categoryByName: Map<string, Category>
    categoryBySlug: Map<string, Category>
    tagByName: Map<string, Tag>
    tagBySlug: Map<string, Tag>
  }) {
    this.friends = input.friends
    this.pages = input.pages
    this.allPosts = input.allPosts
    this.publicPosts = input.publicPosts
    this.categories = input.categories
    this.tags = input.tags
    this.bySlug = input.bySlug
    this.byAlias = input.byAlias
    this.pageBySlug = input.pageBySlug
    this.categoryByName = input.categoryByName
    this.categoryBySlug = input.categoryBySlug
    this.tagByName = input.tagByName
    this.tagBySlug = input.tagBySlug
  }

  getPosts(options: LoadPostsOptions): Post[] {
    if (!options.hidden && !options.schedule) {
      return this.publicPosts
    }
    return this.allPosts
      .filter((post) => post.visible || options.hidden)
      .filter((post) => post.date <= new Date() || options.schedule)
  }

  getPost(slug: string): Post | undefined {
    return this.bySlug.get(slug) ?? this.byAlias.get(slug)
  }

  getPage(slug: string): Page | undefined {
    return this.pageBySlug.get(slug)
  }

  getCategory(name?: string, slug?: string): Category | undefined {
    if (name !== undefined) {
      const byName = this.categoryByName.get(name)
      if (byName) return byName
    }
    if (slug !== undefined) {
      return this.categoryBySlug.get(slug)
    }
    return undefined
  }

  getTag(name?: string, slug?: string): Tag | undefined {
    if (name !== undefined) {
      const byName = this.tagByName.get(name)
      if (byName) return byName
    }
    if (slug !== undefined) {
      return this.tagBySlug.get(slug)
    }
    return undefined
  }
}
