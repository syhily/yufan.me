import type { TOCItemType } from 'fumadocs-core/toc'
import type { MDXContent } from 'mdx/types'
import type { ReactNode } from 'react'

import { pinyin } from 'pinyin-pro'
import YAML from 'yaml'

import config from '@/blog.config'
import { parseContent } from '@/services/markdown/parser'
import { getLogger } from '@/shared/logger'

const log = getLogger('content.catalog')

interface DocModule<Frontmatter> {
  default: MDXContent
  frontmatter: Frontmatter
  toc: TOCItemType[]
  structuredData: unknown
  extractedReferences?: unknown[]
}

export interface MarkdownHeading {
  depth: number
  slug: string
  text: string
}

type PostModule = DocModule<{
  title: string
  slug: string
  date: Date
  updated?: Date
  comments?: boolean
  alias?: string[]
  tags?: string[]
  category: string
  summary?: string
  cover?: string
  og?: string
  published?: boolean
  visible?: boolean
  toc?: boolean
}>

type PageModule = DocModule<{
  title: string
  slug: string
  date: Date
  updated?: Date
  comments?: boolean
  cover: string
  og?: string
  published?: boolean
  summary?: string
  toc?: boolean
}>

type CategoryMeta = {
  name: string
  slug: string
  cover: string
  description?: string
}

type FriendMeta = {
  website: string
  description?: string
  homepage: string
  poster: string
}

type TagMeta = {
  name: string
  slug: string
}

export type Friend = FriendMeta

export type Page = {
  title: string
  date: Date
  updated?: Date
  comments: boolean
  cover: string
  og?: string
  published: boolean
  summary?: string
  toc: boolean
  slug: string
  permalink: string
  body: MDXContent
  headings: MarkdownHeading[]
  structuredData: unknown
  raw: () => Promise<string>
}

export type Post = {
  title: string
  date: Date
  updated?: Date
  comments: boolean
  alias: string[]
  tags: string[]
  category: string
  summary: string
  cover: string
  og?: string
  published: boolean
  visible: boolean
  toc: boolean
  slug: string
  permalink: string
  body: MDXContent
  headings: MarkdownHeading[]
  structuredData: unknown
  raw: () => Promise<string>
}

export type Category = CategoryMeta & { counts: number; permalink: string; description: string }
export type Tag = TagMeta & { counts: number; permalink: string }

export interface LoadPostsOptions {
  hidden: boolean
  schedule: boolean
}

const POST_MODULES = import.meta.glob<PostModule>('/src/content/posts/**/*.mdx', { eager: true })
const PAGE_MODULES = import.meta.glob<PageModule>('/src/content/pages/**/*.mdx', { eager: true })
const RAW_POST_MODULES = import.meta.glob<string>('/src/content/posts/**/*.mdx', {
  eager: true,
  import: 'default',
  query: '?raw',
})
const RAW_PAGE_MODULES = import.meta.glob<string>('/src/content/pages/**/*.mdx', {
  eager: true,
  import: 'default',
  query: '?raw',
})
const CATEGORY_MODULES = import.meta.glob<string>('/src/content/metas/categories.yaml', {
  eager: true,
  import: 'default',
  query: '?raw',
})
const FRIEND_MODULES = import.meta.glob<string>('/src/content/metas/friends.yaml', {
  eager: true,
  import: 'default',
  query: '?raw',
})
const TAG_MODULES = import.meta.glob<string>('/src/content/metas/tags.yaml', {
  eager: true,
  import: 'default',
  query: '?raw',
})

function findPostModule(slug: string): PostModule | undefined {
  return Object.values(POST_MODULES).find((post) => post.frontmatter.slug === slug)
}

function findPageModule(slug: string): PageModule | undefined {
  return Object.values(PAGE_MODULES).find((page) => page.frontmatter.slug === slug)
}

export function getPostBody(slug: string): MDXContent | undefined {
  return findPostModule(slug)?.default
}

export function getPageBody(slug: string): MDXContent | undefined {
  return findPageModule(slug)?.default
}

function headingText(title: ReactNode): string {
  if (typeof title === 'string') return title
  if (typeof title === 'number') return `${title}`
  if (Array.isArray(title)) return title.map((item) => headingText(item)).join('')
  return ''
}

function toHeadings(toc: TOCItemType[]): MarkdownHeading[] {
  return toc
    .map((item) => {
      const slug = item.url.startsWith('#') ? item.url.slice(1) : item.url
      return {
        depth: item.depth,
        slug,
        text: headingText(item.title),
      }
    })
    .filter((item) => item.slug !== '' && item.text !== '')
}

function flattenMetaModules<Entry>(modules: Record<string, string>) {
  return Object.values(modules).flatMap((source) => {
    const parsed = YAML.parse(source)
    return Array.isArray(parsed) ? (parsed as Entry[]) : []
  })
}

function buildPage(modulePath: string, page: PageModule): Page {
  const slug = page.frontmatter.slug
  const raw = RAW_PAGE_MODULES[modulePath] ?? ''
  return {
    ...page.frontmatter,
    comments: page.frontmatter.comments ?? true,
    published: page.frontmatter.published ?? true,
    summary: page.frontmatter.summary ?? '',
    toc: page.frontmatter.toc ?? false,
    slug,
    permalink: `/${slug}`,
    body: page.default,
    headings: toHeadings(page.toc),
    structuredData: page.structuredData,
    raw: async () => raw,
  }
}

function buildPost(modulePath: string, post: PostModule): Post {
  const slug = post.frontmatter.slug
  const raw = RAW_POST_MODULES[modulePath] ?? ''
  return {
    ...post.frontmatter,
    comments: post.frontmatter.comments ?? true,
    alias: post.frontmatter.alias ?? [],
    tags: post.frontmatter.tags ?? [],
    summary: post.frontmatter.summary ?? '',
    cover: post.frontmatter.cover ?? '',
    published: post.frontmatter.published ?? true,
    visible: post.frontmatter.visible ?? true,
    toc: post.frontmatter.toc ?? false,
    slug,
    permalink: `/posts/${slug}`,
    body: post.default,
    headings: toHeadings(post.toc),
    structuredData: post.structuredData,
    raw: async () => raw,
  }
}

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
    const friends: Friend[] = flattenMetaModules(FRIEND_MODULES)

    const pages: Page[] = Object.entries(PAGE_MODULES)
      .map(([modulePath, page]) => buildPage(modulePath, page))
      .filter((page) => page.published || !import.meta.env.PROD)

    const allPosts: Post[] = Object.entries(POST_MODULES)
      .map(([modulePath, post]) => buildPost(modulePath, post))
      .filter((post) => post.published || !import.meta.env.PROD)
      .sort((left, right) => {
        const a = left.date.getTime()
        const b = right.date.getTime()
        return config.settings.post.sort === 'asc' ? a - b : b - a
      })

    const categoriesMeta = flattenMetaModules<CategoryMeta>(CATEGORY_MODULES)
    const categories: Category[] = categoriesMeta.map((cat) => ({
      ...cat,
      description: cat.description ?? '',
      counts: allPosts.filter((post) => post.category === cat.name).length,
      permalink: `/cats/${cat.slug}`,
    }))

    for (const category of categories) {
      if (category.description !== '') {
        category.description = await parseContent(category.description)
      }
    }

    const tagsMeta = flattenMetaModules<TagMeta>(TAG_MODULES)
    const tags: Tag[] = tagsMeta.map((tag) => ({
      ...tag,
      counts: allPosts.filter((post) => post.tags.includes(tag.name)).length,
      permalink: `/tags/${tag.slug}`,
    }))

    const missingCategories: string[] = allPosts
      .map((post) => post.category)
      .filter((category) => !categories.find((cat) => cat.name === category))
    if (missingCategories.length > 0) {
      throw new Error(`The bellowing categories has not been configured:\n${missingCategories.join('\n')}`)
    }

    const missingTags: string[] = allPosts
      .flatMap((post) => post.tags)
      .filter((tag) => !tags.find((item) => item.name === tag))
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

    for (const post of allPosts) {
      if (post.cover === '') {
        const category = categories.find((cat) => cat.name === post.category)
        if (category !== undefined) {
          post.cover = category.cover
        }
      }
    }

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

    const now = new Date()
    const publicPosts = allPosts.filter((post) => post.visible && post.date <= now)

    const pageBySlug = new Map<string, Page>()
    for (const page of pages) pageBySlug.set(page.slug, page)

    const categoryByName = new Map<string, Category>()
    const categoryBySlug = new Map<string, Category>()
    for (const category of categories) {
      categoryByName.set(category.name, category)
      categoryBySlug.set(category.slug, category)
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
  readonly allPosts: Post[]
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
