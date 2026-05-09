import type { MarkdownHeading } from '@/shared/toc'

export type { MarkdownHeading }

export interface Friend {
  website: string
  description?: string
  homepage: string
  poster: string
  posterThumbhash?: string
}

export interface Category {
  name: string
  slug: string
  cover: string
  coverThumbhash?: string
  description: string
  counts: number
  permalink: string
}

export interface Tag {
  name: string
  slug: string
  counts: number
  permalink: string
}

export interface ClientPage {
  title: string
  date: Date
  updated?: Date
  comments: boolean
  cover: string
  coverThumbhash?: string
  /** Intrinsic cover dimensions resolved from the `image` row at catalog hydration. */
  coverWidth?: number
  coverHeight?: number
  og?: string
  published: boolean
  summary: string
  toc: boolean
  /**
   * When true the public detail route appends the global friends grid
   * at the bottom of the body. The grid lives **outside** the body —
   * the PortableText dialect deliberately has no friends block, so
   * the operator can flip this on/off from the editor's right
   * sidebar without re-publishing the body. Always `false` for
   * MDX-sourced pages (those still embed `<Friends />` inline as an
   * MDX component when they want the grid).
   */
  showFriends: boolean
  slug: string
  permalink: string
  headings: MarkdownHeading[]
}

export interface ClientPost {
  title: string
  date: Date
  updated?: Date
  comments: boolean
  alias: string[]
  tags: string[]
  category: string
  summary: string
  cover: string
  coverThumbhash?: string
  og?: string
  published: boolean
  visible: boolean
  toc: boolean
  slug: string
  permalink: string
  headings: MarkdownHeading[]
}

export type ClientCategory = Category
export type ClientTag = Tag

export interface PostMetadata {
  likes: number
  views: number
  comments: number
}

export type ClientPostWithMetadata = ClientPost & { meta: PostMetadata }

export interface PostVisibilityOptions {
  includeHidden: boolean
  includeScheduled: boolean
}

export interface LoadPostsWithMetadataOptions {
  likes: boolean
  views: boolean
  comments: boolean
}

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

export interface DetailPageShell {
  slug: string
  title: string
  summary: string
  cover: string
  coverThumbhash?: string
  /** Intrinsic cover dimensions resolved from the `image` row at catalog hydration. */
  coverWidth?: number
  coverHeight?: number
  permalink: string
  date: Date
  updated?: Date
  og?: string
  comments: boolean
  toc: boolean
  headings: MarkdownHeading[]
}

export interface SidebarPostLink {
  slug: string
  title: string
  permalink: string
}

export interface SidebarTagLink {
  name: string
  slug: string
  permalink: string
  counts: number
}

export interface CommentFormUser {
  id: string
  name: string
  email: string
  website: string | null
  admin: boolean
}
