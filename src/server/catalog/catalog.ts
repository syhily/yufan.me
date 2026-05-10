import type {
  Category,
  ClientPost,
  Friend,
  LoadPostsWithMetadataOptions,
  Page,
  Post,
  PostMetadata,
  PostVisibilityOptions,
  Tag,
} from '@/server/catalog/schema'

import { toClientPost } from '@/server/catalog/schema'
import { loadCatalogPages, type CmsPage } from '@/server/cms/pages/service'
import { loadCatalogPostMetas } from '@/server/cms/posts/service'
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

// Promote a `CmsPage` (DB-backed projection) into the catalog's
// internal `Page` shape. Pages with no published revision still
// surface so editors can link to them while drafting; the public
// detail route renders an empty body in that case.
//
// Exported because the page-detail route needs to project a draft
// `CmsPage` (returned by `loadPageDraftPreviewBySlug`) into the
// same `Page` shape the public branch consumes — so the JSX tree
// reads the same loader payload regardless of whether the page
// came from the catalog or from the admin preview path.
export function buildDbPage(page: CmsPage): Page {
  return {
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

    // Pages live exclusively in the `page` + `content` Postgres
    // tables and are edited through `/wp-admin/pages`. The catalog
    // ONLY exposes published, non-deleted, non-future-scheduled
    // rows — `loadCatalogPages()` enforces all three gates in the
    // service layer. There is intentionally no dev-only backdoor
    // for unpublished pages: admin preview goes through a separate
    // path (`loadPageDraftPreviewBySlug` + the page-detail loader's
    // admin branch) so an authenticated admin can see what they
    // just unpublished — and on already-live pages can preview the
    // latest draft via `?draft=true` — while anonymous visitors keep
    // getting 404 / the published version in every environment.
    //
    // A Postgres outage degrades to an empty page list — the
    // public site still renders posts and taxonomies — so a
    // transient DB failure can't take the whole surface offline.
    let pages: Page[] = []
    try {
      const cmsPages = await loadCatalogPages()
      pages = cmsPages.map(buildDbPage)
    } catch (error) {
      log.warn('catalog.db_pages.load_failed', { error: String(error) })
    }

    let allPosts: Post[] = []
    try {
      allPosts = await loadCatalogPostMetas()
    } catch (error) {
      log.warn('catalog.db_posts.load_failed', { error: String(error) })
    }

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
      // Re-stamp the cover URL with the live `?v=<updatedAtMs>` cache
      // buster taken from the current `image` row. Without this, a
      // re-upload of the same library image (which only mutates the
      // S3 object + bumps `image.updatedAt`) would never reach
      // browsers because the page / post / friend row still stores
      // the URL snapshot from the original pick.
      if (lookup?.publicUrl !== undefined && lookup.publicUrl !== null) {
        ;(item as Record<SrcKey, string>)[srcKey] = lookup.publicUrl
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
// Page slugs come from a single emitter: the DB `page` table
// (admin-edited via `/wp-admin/pages/...`). The DB-level
// `UNIQUE(slug)` on that table only catches page↔page collisions,
// and the page-service's pre-save `findPageMetaBySlug` check is
// also page↔page only. **This is the only place the codebase
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
