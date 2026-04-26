import type { ClientPage, ClientPost, MarkdownHeading, PostMetadata } from '@/server/catalog/schema'

// Narrow projections sent over the wire to the public-side React components.
// `ClientPost` already strips the heavy MDX `body` / `structuredData`, but
// listing routes still don't need most of its remaining fields, so we trim
// them further here. See `phase3-trim-payloads` in the refactor plan.

// Card shown on every public listing surface (home feed, category list, tag
// list, search results, archives). Components only need these fields to
// render the cover, title, summary, breadcrumb chip, date, and metric icons.
export interface ListingPostCard {
  slug: string
  title: string
  summary: string
  cover: string
  coverThumbhash?: string
  permalink: string
  category: string
  date: Date
  /** Drafts get a "【草稿】" prefix in the listing title. */
  published: boolean
}

export type ListingPostCardWithMetadata = ListingPostCard & { meta: PostMetadata }

export function toListingPostCard(post: ClientPost): ListingPostCard {
  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    cover: post.cover,
    coverThumbhash: post.coverThumbhash,
    permalink: post.permalink,
    category: post.category,
    date: post.date,
    published: post.published,
  }
}

// Detail-page projection consumed by `<PostDetailBody>` /
// `<PageDetailBody>`. Includes the SEO inputs (`og`, `headings`, `updated`)
// required by `seoForPost`/`seoForPage` and the like/share UIs.
export interface DetailPostShell {
  slug: string
  title: string
  summary: string
  cover: string
  coverThumbhash?: string
  permalink: string
  category: string
  tags: string[]
  date: Date
  updated?: Date
  og?: string
  comments: boolean
  toc: boolean
  headings: MarkdownHeading[]
}

export function toDetailPostShell(post: ClientPost): DetailPostShell {
  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    cover: post.cover,
    coverThumbhash: post.coverThumbhash,
    permalink: post.permalink,
    category: post.category,
    tags: post.tags,
    date: post.date,
    updated: post.updated,
    og: post.og,
    comments: post.comments,
    toc: post.toc,
    headings: post.headings,
  }
}

// Same idea for pages: drop the parts of `ClientPage` the public-facing UI
// never reads (`alias`, `published`, `visible`, etc. don't exist on pages,
// but `comments`/`toc`/`headings` etc. are still needed).
export interface DetailPageShell {
  slug: string
  title: string
  summary: string
  cover: string
  coverThumbhash?: string
  permalink: string
  date: Date
  updated?: Date
  og?: string
  comments: boolean
  toc: boolean
  headings: MarkdownHeading[]
}

export function toDetailPageShell(page: ClientPage): DetailPageShell {
  return {
    slug: page.slug,
    title: page.title,
    summary: page.summary,
    cover: page.cover,
    coverThumbhash: page.coverThumbhash,
    permalink: page.permalink,
    date: page.date,
    updated: page.updated,
    og: page.og,
    comments: page.comments,
    toc: page.toc,
    headings: page.headings,
  }
}

// Sidebar `RandomPosts` widget only needs the link target + label.
export interface SidebarPostLink {
  slug: string
  title: string
  permalink: string
}

export function toSidebarPostLink(post: ClientPost): SidebarPostLink {
  return { slug: post.slug, title: post.title, permalink: post.permalink }
}

// Sidebar `RandomTags` widget only needs name/permalink/counts (the tooltip
// shows the count).
export interface SidebarTagLink {
  name: string
  slug: string
  permalink: string
  counts: number
}

// Comment reply form's view of the current viewer. Today this matches
// `SessionUser` (the session is already minimal — id/name/email/website/
// admin), but a dedicated alias keeps the boundary explicit so future
// session fields don't accidentally leak into the public DOM.
export interface CommentFormUser {
  id: string
  name: string
  email: string
  website: string | null
  admin: boolean
}
