import type { TOCItemType } from 'fumadocs-core/toc'

import { pages as pageEntries, posts as postEntries } from '#source/server'
import { isValidElement, type ReactNode } from 'react'

import type {
  Category,
  ClientPost,
  Friend,
  LoadPostsWithMetadataOptions,
  MarkdownHeading,
  Page,
  Post,
  PostMetadata,
  PostVisibilityOptions,
  Tag,
} from '@/server/catalog/schema'

import { toClientPost } from '@/server/catalog/schema'
import { loadCatalogPages, type CmsPage } from '@/server/cms/pages/service'
import { queryMetadata } from '@/server/comments/likes'
import { listPublicCategoryRows } from '@/server/db/query/category'
import { listPublicTagRows } from '@/server/db/query/tag'
import { listPublicFriends } from '@/server/friends/service'
import { loadImageThumbhash } from '@/server/images/render-enhance'
import { getLogger } from '@/server/logger'
import { parseContent } from '@/server/markdown/parser'
import { deriveSlug } from '@/server/slug'
import { requireBlogSettingsSection } from '@/shared/blog-config'

// Inline projection types so the catalog does not have to import the
// `categories` / `tags` service modules (which re-import the catalog
// for their delete-block guard, forming a cycle).
interface PublicCategoryEntry {
  name: string
  slug: string
  cover: string
  description: string
}

interface PublicTagEntry {
  name: string
  slug: string
}

const log = getLogger('content.catalog')

type SourcePost = (typeof postEntries)[number]
type SourcePage = (typeof pageEntries)[number]

// Lookup `keys` against `items` and return the matching values in the
// requested key order. Missing keys are silently dropped — callers want a
// stable iteration order, not strict validation.
function valuesByKeys<T>(items: ReadonlyMap<string, T>, keys: readonly string[]): T[] {
  const values: T[] = []
  for (const key of keys) {
    const value = items.get(key)
    if (value !== undefined) {
      values.push(value)
    }
  }
  return values
}

function headingText(title: ReactNode): string {
  if (typeof title === 'string') {
    return title
  }
  if (typeof title === 'number') {
    return `${title}`
  }
  if (Array.isArray(title)) {
    return title.map((item) => headingText(item)).join('')
  }
  if (isValidElement(title)) {
    const props = title.props as { children?: ReactNode }
    return headingText(props.children)
  }
  return ''
}

function toHeadings(toc: unknown): MarkdownHeading[] {
  const items = normalizeTocItems(toc)
  return items
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

function isTocItem(value: unknown): value is TOCItemType {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const item = value as Record<string, unknown>
  return typeof item.url === 'string' && typeof item.depth === 'number'
}

function normalizeTocItems(toc: unknown): TOCItemType[] {
  const candidates = Array.isArray(toc)
    ? toc
    : typeof toc === 'object' && toc !== null && Array.isArray((toc as { items?: unknown }).items)
      ? (toc as { items: unknown[] }).items
      : []
  return candidates.filter(isTocItem)
}

function compiledToc(entry: { toc: unknown; _exports?: Record<string, unknown> }): unknown {
  return entry._exports?.toc ?? entry.toc
}

// Promote a `CmsPage` (DB-backed projection) into the catalog's
// internal `Page` shape. Pages with no published revision still surface
// so editors can link to them while drafting; the public detail route
// renders an empty body in that case.
function buildDbPage(page: CmsPage): Page {
  return {
    source: 'db',
    title: page.title,
    date: page.date,
    updated: page.updated,
    comments: page.comments,
    cover: page.cover,
    coverThumbhash: page.coverThumbhash,
    coverWidth: page.coverWidth,
    coverHeight: page.coverHeight,
    og: page.og,
    published: page.published,
    summary: page.summary,
    toc: page.toc,
    showFriends: page.showFriends,
    slug: page.slug,
    permalink: page.permalink,
    headings: page.headings,
    body: page.body,
    imageSources: page.imageSources,
    publishedRevisionId: page.publishedRevisionId,
  }
}

function buildPage(page: SourcePage): Page {
  const slug = page.slug
  return {
    source: 'mdx',
    title: page.title,
    date: page.date,
    updated: page.updated,
    comments: page.comments ?? true,
    cover: page.cover,
    og: page.og,
    published: page.published ?? true,
    summary: page.summary ?? '',
    toc: page.toc ?? false,
    // MDX pages embed `<Friends />` in their body directly (see
    // `src/content/pages/links.mdx`); the meta toggle is a DB-only
    // affordance, so MDX-sourced pages always read `false`. The
    // detail route therefore won't double up — the body's
    // `<Friends />` keeps rendering as before.
    showFriends: false,
    slug,
    permalink: `/${slug}`,
    body: page.body,
    headings: toHeadings(compiledToc(page)),
    mdxPath: page.info.path,
    imageSources: (page._exports?.imageSources as string[] | undefined) ?? [],
  }
}

function buildPost(post: SourcePost): Post {
  const slug = post.slug
  return {
    title: post.title,
    date: post.date,
    updated: post.updated,
    comments: post.comments ?? true,
    alias: post.alias ?? [],
    tags: post.tags ?? [],
    category: post.category,
    summary: post.summary ?? '',
    cover: post.cover ?? '',
    og: post.og,
    published: post.published ?? true,
    visible: post.visible ?? true,
    toc: post.toc ?? false,
    slug,
    permalink: `/posts/${slug}`,
    body: post.body,
    headings: toHeadings(compiledToc(post)),
    structuredData: post.structuredData,
    mdxPath: post.info.path,
    imageSources: (post._exports?.imageSources as string[] | undefined) ?? [],
  }
}

// Best-effort runtime fallback for tags that appear in a post but aren't
// declared in the `tag` table. Canonical slugs for declared tags are
// produced server-side via `deriveSlug` in `@/server/tags/service`,
// so this path should only fire when an author references a brand-new
// tag from a post without adding the matching row through
// `/wp-admin/tags`. Routing through `deriveSlug` gives Han-only tag
// names a pinyin slug here too, matching what the admin would write
// — `pinyin-pro` only ships server-side so this stays out of the
// client bundle.
function fallbackTagSlug(name: string): string {
  const slug = deriveSlug(name)
  if (slug !== '') {
    return slug
  }
  // Pure non-ASCII / emoji tags fall through here; encodeURIComponent
  // keeps the URL legal even if it isn't pretty. Authors should add
  // the entry through `/wp-admin/tags` to fix it properly.
  return encodeURIComponent(name.trim().toLowerCase())
}

interface CatalogInput {
  friends: Friend[]
  pages: Page[]
  allPosts: Post[]
  categories: Category[]
  categoryLinkByName: Map<string, string>
  tags: Tag[]
  bySlug: Map<string, Post>
  byAlias: Map<string, Post>
  pageBySlug: Map<string, Page>
  categoryByName: Map<string, Category>
  categoryBySlug: Map<string, Category>
  tagByName: Map<string, Tag>
  tagBySlug: Map<string, Tag>
  postsByCategory: Map<string, Post[]>
  postsByTag: Map<string, Post[]>
  permalinks: Set<string>
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
    // Friends used to live in `src/content/metas/friends.yaml` and were
    // loaded via Fumadocs at MDX build time. They now live in the
    // `friend` Postgres table so admins can edit the list from
    // `/wp-admin/friends` without redeploying. The DTO shape matches
    // the historical YAML so `<Friends />` and the rest of the
    // pipeline (thumbhash hydration, MDX components map) stay
    // unchanged.
    const friends: Friend[] = (await listPublicFriends()).map((row) => ({
      website: row.website,
      description: row.description,
      homepage: row.homepage,
      poster: row.poster,
    }))

    // Pages can be sourced from MDX (legacy) or from the `page` +
    // `content` Postgres tables (the new editor). DB pages take
    // precedence: if a DB row exists with the same slug as an MDX
    // file, the MDX file is dropped from the catalog so the admin's
    // live edit always wins. The dev environment keeps unpublished
    // pages visible (matching the historical behaviour) so authors
    // can preview drafts without flipping `published=true`.
    let dbPages: Page[] = []
    try {
      const cmsPages = await loadCatalogPages()
      dbPages = cmsPages.map(buildDbPage).filter((page) => page.published || !import.meta.env.PROD)
    } catch (error) {
      // Swallow DB outages so static MDX content can still render
      // when Postgres is unreachable. The error is logged so an
      // operator can see it in the structured log.
      log.warn('catalog.db_pages.load_failed', { error: String(error) })
    }
    const dbPageSlugs = new Set(dbPages.map((page) => page.slug))
    const mdxPages = pageEntries
      .map(buildPage)
      .filter((page) => !dbPageSlugs.has(page.slug))
      .filter((page) => page.published || !import.meta.env.PROD)
    const pages: Page[] = [...dbPages, ...mdxPages]

    const allPosts = postEntries
      .map(buildPost)
      .filter((post) => post.published || !import.meta.env.PROD)
      .sort((left, right) => {
        const a = left.date.getTime()
        const b = right.date.getTime()
        return requireBlogSettingsSection('content').post.sort === 'asc' ? a - b : b - a
      })

    const now = new Date()
    const categoryVisiblePosts = allPosts.filter((post) => post.date <= now)

    // Pre-bucket posts once by category and by tag. The full indexes power
    // admin-aware lookups. Category/tag counts, taxonomy listings, archives,
    // search, feeds, and sitemap intentionally include hidden posts while
    // scheduled posts remain excluded from public listing surfaces.
    const postsByCategory = bucket(allPosts, (post) => [post.category])
    const postsByTag = bucket(allPosts, (post) => post.tags)
    const categoryPostsByCategory = bucket(categoryVisiblePosts, (post) => [post.category])
    const tagVisiblePosts = bucket(categoryVisiblePosts, (post) => post.tags)

    // Categories and tags used to live in `src/content/metas/{categories,tags}.yaml`
    // and were loaded via Fumadocs at MDX build time. They now live in
    // the `category` and `tag` Postgres tables so admins can edit the
    // lists from `/wp-admin/categories` and `/wp-admin/tags` without
    // redeploying. We hit the query layer directly (rather than going
    // through `@/server/categories/service` / `@/server/tags/service`)
    // because those modules import the catalog back for their
    // delete-block guard, which would form a circular dependency.
    const [categoryRows, tagRows] = await Promise.all([listPublicCategoryRows(), listPublicTagRows()])
    const categoryEntries: PublicCategoryEntry[] = categoryRows.map((row) => ({
      name: row.name,
      slug: row.slug,
      cover: row.cover,
      description: row.description,
    }))
    const tagEntries: PublicTagEntry[] = tagRows.map((row) => ({ name: row.name, slug: row.slug }))
    const categories = await buildCategories(categoryEntries, categoryPostsByCategory)
    const tags = buildTags(tagEntries, tagVisiblePosts)
    validateTaxonomies(allPosts, categories, tags)
    fillMissingTags(allPosts, tags, tagVisiblePosts)
    await hydrateImages(categories, 'cover', 'coverThumbhash')
    fillMissingPostCovers(allPosts, categories)
    await Promise.all([
      hydrateImages(allPosts, 'cover', 'coverThumbhash'),
      hydrateImages(pages, 'cover', 'coverThumbhash', { widthKey: 'coverWidth', heightKey: 'coverHeight' }),
      hydrateImages(friends, 'poster', 'posterThumbhash'),
    ])

    const { bySlug, byAlias, postSlugs } = indexPosts(allPosts)
    validatePageSlugs(pages, postSlugs)
    validateFeaturePosts(postSlugs)

    const pageBySlug = new Map(pages.map((page) => [page.slug, page]))
    const categoryByName = new Map(categories.map((category) => [category.name, category]))
    const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
    const tagByName = new Map(tags.map((tag) => [tag.name, tag]))
    const tagBySlug = new Map(tags.map((tag) => [tag.slug, tag]))
    const permalinks = new Set([...allPosts.map((post) => post.permalink), ...pages.map((page) => page.permalink)])

    // Direct name → permalink lookup for the home/listing routes that need to
    // attach a category breadcrumb chip per post. The previous implementation
    // built a `new Set(...)` + `getCategoriesByName` round-trip per request;
    // a single Map read replaces that hot path.
    const categoryLinkByName = new Map(categories.map((category) => [category.name, category.permalink]))

    return new ContentCatalog({
      friends,
      pages,
      allPosts,
      categories,
      categoryLinkByName,
      tags,
      bySlug,
      byAlias,
      pageBySlug,
      categoryByName,
      categoryBySlug,
      tagByName,
      tagBySlug,
      postsByCategory,
      postsByTag,
      permalinks,
    })
  }

  readonly friends!: Friend[]
  readonly pages!: Page[]
  readonly allPosts!: Post[]
  readonly categories!: Category[]
  readonly categoryLinkByName!: Map<string, string>
  readonly tags!: Tag[]
  readonly permalinks!: Set<string>

  private readonly bySlug!: Map<string, Post>
  private readonly byAlias!: Map<string, Post>
  private readonly pageBySlug!: Map<string, Page>
  private readonly categoryByName!: Map<string, Category>
  private readonly categoryBySlug!: Map<string, Category>
  private readonly tagByName!: Map<string, Tag>
  private readonly tagBySlug!: Map<string, Tag>
  private readonly postsByCategory!: Map<string, Post[]>
  private readonly postsByTag!: Map<string, Post[]>

  // Per-Post `toClientPost` cache. Same `Post` reference always yields the
  // same frozen DTO, which lets listing routes pass identical references on
  // back-to-back navigations and lets React skip subtree reconciliation in
  // the home-feed grid.
  private readonly clientPostCache: WeakMap<Post, ClientPost> = new WeakMap()

  private constructor(input: CatalogInput) {
    Object.assign(this, input)
  }

  getPosts(options: PostVisibilityOptions): Post[] {
    return this.applyOptions(this.allPosts, options)
  }

  // Listing routes universally need the `ClientPost` projection. Cache the
  // mapped object per source `Post` so repeated calls (home + sidebar +
  // archives) share one allocation per post per process.
  toClientPost(post: Post): ClientPost {
    const cached = this.clientPostCache.get(post)
    if (cached !== undefined) {
      return cached
    }
    const client = toClientPost(post)
    this.clientPostCache.set(post, client)
    return client
  }

  getClientPosts(options: PostVisibilityOptions): ClientPost[] {
    return this.getPosts(options).map((post) => this.toClientPost(post))
  }

  // Resolve the canonical category permalink for the breadcrumb chip on
  // post cards. Returns "" when the category isn't configured (matches the
  // historic behaviour the home loader relied on).
  getCategoryLink(name: string): string {
    return this.categoryLinkByName.get(name) ?? ''
  }

  getPost(slug: string): Post | undefined {
    return this.bySlug.get(slug) ?? this.byAlias.get(slug)
  }

  getPage(slug: string): Page | undefined {
    return this.pageBySlug.get(slug)
  }

  getCategoryByName(name: string): Category | undefined {
    return this.categoryByName.get(name)
  }

  getCategoryBySlug(slug: string): Category | undefined {
    return this.categoryBySlug.get(slug)
  }

  getCategory(name?: string, slug?: string): Category | undefined {
    if (name !== undefined) {
      const byName = this.getCategoryByName(name)
      if (byName) {
        return byName
      }
    }
    return slug === undefined ? undefined : this.getCategoryBySlug(slug)
  }

  getTagByName(name: string): Tag | undefined {
    return this.tagByName.get(name)
  }

  getTagBySlug(slug: string): Tag | undefined {
    return this.tagBySlug.get(slug)
  }

  getTag(name?: string, slug?: string): Tag | undefined {
    if (name !== undefined) {
      const byName = this.getTagByName(name)
      if (byName) {
        return byName
      }
    }
    return slug === undefined ? undefined : this.getTagBySlug(slug)
  }

  getCategoriesByName(names: readonly string[]): Category[] {
    return valuesByKeys(this.categoryByName, names)
  }

  getTagsByName(names: readonly string[]): Tag[] {
    return valuesByKeys(this.tagByName, names)
  }

  // Listing and feed routes choose explicit visibility options. This combines
  // taxonomy filtering with hidden/scheduled filtering against the precomputed
  // indexes so call sites stay one line.
  getPostsByTaxonomy(filter: { categoryName?: string; tagName?: string }, options: PostVisibilityOptions): Post[] {
    if (filter.categoryName !== undefined) {
      return this.applyOptions(this.postsByCategory.get(filter.categoryName) ?? [], options)
    }
    if (filter.tagName !== undefined) {
      return this.applyOptions(this.postsByTag.get(filter.tagName) ?? [], options)
    }
    return this.getPosts(options)
  }

  getPostsBy(filter: { category?: string; tag?: string }, options: PostVisibilityOptions): Post[] {
    return this.getPostsByTaxonomy({ categoryName: filter.category, tagName: filter.tag }, options)
  }

  getPostsBySlugs(slugs: readonly string[], options: PostVisibilityOptions): Post[] {
    return this.applyOptions(valuesByKeys(this.bySlug, slugs), options)
  }

  private applyOptions(posts: Post[], options: PostVisibilityOptions): Post[] {
    return applyPostOptions(posts, options)
  }
}

async function buildCategories(
  entries: PublicCategoryEntry[],
  postsByCategory: Map<string, Post[]>,
): Promise<Category[]> {
  const categories = entries.map((category) => ({
    name: category.name,
    slug: category.slug,
    cover: category.cover,
    description: category.description,
    counts: postsByCategory.get(category.name)?.length ?? 0,
    permalink: `/cats/${category.slug}`,
  }))

  for (const category of categories) {
    if (category.description !== '') {
      category.description = await parseContent(category.description)
    }
  }

  return categories
}

function buildTags(entries: PublicTagEntry[], postsByTag: Map<string, Post[]>): Tag[] {
  return entries.map((tag) => ({
    name: tag.name,
    slug: tag.slug,
    counts: postsByTag.get(tag.name)?.length ?? 0,
    permalink: `/tags/${tag.slug}`,
  }))
}

function validateTaxonomies(posts: Post[], categories: Category[], tags: Tag[]): void {
  const categoryNames = new Set(categories.map((cat) => cat.name))
  const missingCategories = posts.map((post) => post.category).filter((category) => !categoryNames.has(category))
  if (missingCategories.length > 0) {
    throw new Error(`The following categories have not been configured:\n${missingCategories.join('\n')}`)
  }

  const tagNames = new Set(tags.map((tag) => tag.name))
  const missingTags = posts.flatMap((post) => post.tags).filter((tag) => !tagNames.has(tag))
  if (missingTags.length > 0) {
    log.warn(
      'auto-deriving missing tag definitions; add them through `/wp-admin/tags` so the canonical pinyin slug is stored in the `tag` table',
      { missing: missingTags },
    )
  }
}

function fillMissingTags(posts: Post[], tags: Tag[], postsByTag: Map<string, Post[]>): void {
  const configured = new Set(tags.map((tag) => tag.name))
  for (const missingTag of posts.flatMap((post) => post.tags)) {
    if (configured.has(missingTag)) {
      continue
    }
    configured.add(missingTag)
    const slug = fallbackTagSlug(missingTag)
    tags.push({
      name: missingTag,
      slug,
      permalink: `/tags/${slug}`,
      counts: postsByTag.get(missingTag)?.length ?? 0,
    })
  }
}

function fillMissingPostCovers(posts: Post[], categories: Category[]): void {
  const categoryByName = new Map(categories.map((cat) => [cat.name, cat]))
  for (const post of posts) {
    if (post.cover !== '') {
      continue
    }
    const category = categoryByName.get(post.category)
    if (category !== undefined) {
      post.cover = category.cover
      post.coverThumbhash = category.coverThumbhash
    }
  }
}

// Group items into a map keyed by one or more derived keys per item.
function bucket<T, K>(items: T[], keysOf: (item: T) => readonly K[]): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    for (const key of keysOf(item)) {
      const existing = map.get(key)
      if (existing) {
        existing.push(item)
      } else {
        map.set(key, [item])
      }
    }
  }
  return map
}

// Resolves the thumbhash (and optionally the intrinsic width/height) for
// `srcKey` on each item and writes them onto the matching keys.
// Centralising this collapses the previous four near-identical
// `hydrate*Images` helpers and keeps the per-collection wiring at the call
// site (next to where the pipeline ordering matters). Width/height keys
// are opt-in so DTOs that don't carry the fields stay untouched.
interface HydrateImageDimensionKeys<T> {
  widthKey?: keyof T
  heightKey?: keyof T
}

async function hydrateImages<
  T extends Record<SrcKey, string> & Partial<Record<HashKey, string | undefined>>,
  SrcKey extends keyof T,
  HashKey extends keyof T,
>(items: T[], srcKey: SrcKey, hashKey: HashKey, dims: HydrateImageDimensionKeys<T> = {}): Promise<void> {
  await Promise.all(
    items.map(async (item) => {
      const src = item[srcKey] as string
      const lookup = src === '' ? null : await loadImageThumbhash(src)
      ;(item as Record<HashKey, string | undefined>)[hashKey] = lookup?.thumbhash
      const dimWritable = item as unknown as Record<PropertyKey, number | undefined>
      if (dims.widthKey !== undefined) {
        dimWritable[dims.widthKey as PropertyKey] = lookup?.width
      }
      if (dims.heightKey !== undefined) {
        dimWritable[dims.heightKey as PropertyKey] = lookup?.height
      }
    }),
  )
}

// Build the post-slug index. The returned `postSlugs` set is the
// **canonical source of truth** for the post half of the global
// slug namespace shared with pages — `validatePageSlugs` below
// reads it to enforce the cross-table invariant. Each post
// contributes its own `slug` plus every entry in `alias[]`; both
// occupy slots in the same namespace, so an alias colliding with
// another post's slug is already caught here too. Post-side
// duplicates abort cold start with a clear `Duplicate post slug`
// error, which is preferable to letting an ambiguous lookup land
// on a random row at request time.
function indexPosts(posts: Post[]) {
  const postSlugs = new Set<string>()
  const bySlug = new Map<string, Post>()
  const byAlias = new Map<string, Post>()

  for (const post of posts) {
    if (postSlugs.has(post.slug)) {
      throw new Error(`Duplicate post slug: ${post.slug}`)
    }
    postSlugs.add(post.slug)
    bySlug.set(post.slug, post)
    for (const alias of post.alias) {
      if (postSlugs.has(alias)) {
        throw new Error(`Duplicate alias ${alias} in post ${post.slug}`)
      }
      postSlugs.add(alias)
      byAlias.set(alias, post)
    }
  }

  return { bySlug, byAlias, postSlugs }
}

// Cross-table fence for the global page↔post slug namespace.
//
// Page slugs come from two emitters: the DB `page` table (admin-
// edited via `/wp-admin/pages/...`) and MDX page frontmatter
// (`src/content/pages/**/*.mdx`). The DB-level `UNIQUE(slug)` on
// the `page` table only catches page↔page collisions; the
// page-service's pre-save `findPageMetaBySlug` check is also
// page↔page only. **This is the only place the codebase
// validates that no page slug collides with a post slug or post
// alias.**
//
// Failure mode: throws and refuses to boot the server. The
// catalog is loaded synchronously at cold start (and rebuilt
// after every admin save via `ContentCatalog.reset()`), so a
// freshly-saved colliding page surfaces as a 500 on the next
// request rather than at save time. Consequence: any new code
// path that introduces another slug emitter MUST be folded into
// either `postSlugs` or this validator — otherwise the global
// invariant silently degrades.
function validatePageSlugs(pages: Page[], postSlugs: Set<string>): void {
  for (const page of pages) {
    if (postSlugs.has(page.slug)) {
      throw new Error(`Page and post share same slug: ${page.slug}`)
    }
  }
}

function validateFeaturePosts(postSlugs: Set<string>): void {
  const featurePosts = requireBlogSettingsSection('content').post.feature ?? []
  const invalidFeaturePosts = featurePosts.filter((slug) => !postSlugs.has(slug))
  if (invalidFeaturePosts.length > 0) {
    throw new Error(`The following feature posts are invalid:\n${invalidFeaturePosts.join('\n')}`)
  }
}

function applyPostOptions(posts: Post[], options: PostVisibilityOptions): Post[] {
  const now = new Date()
  return posts.filter((post) => {
    const visible = options.includeHidden || post.visible
    const published = options.includeScheduled || post.date <= now
    return visible && published
  })
}

// Hydrate a list of posts (or post-like records) with the live aggregated
// metadata stored alongside the catalog (Postgres + Redis). The query is
// short-circuited for empty inputs so listing routes that already filtered
// to zero results don't pay for a round trip.
export async function getClientPostsWithMetadata<PostLike extends { permalink: string }>(
  posts: PostLike[],
  options: LoadPostsWithMetadataOptions,
): Promise<(PostLike & { meta: PostMetadata })[]> {
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
