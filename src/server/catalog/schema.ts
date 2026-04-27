import type { StructuredData } from 'fumadocs-core/mdx-plugins'
import type { MDXContent } from 'mdx/types'

import type { MarkdownHeading } from '@/shared/toc'

export type { MarkdownHeading }

export type Friend = {
  website: string
  description?: string
  homepage: string
  poster: string
  posterThumbhash?: string
}

export type CategoryDescription = {
  /** JS function-body string returned by the runtime MDX compiler. The
   *  React surface (`<MdxRemoteBody>`) calls `executeMdxSync` on this
   *  and renders the resulting component with `postMdxComponents`. */
  compiled: string
  /** Trimmed raw markdown source. Listing SEO (`og:description`) consumes
   *  this directly because the meta-tag pipeline still wants a string. */
  plain: string
}

export type Category = {
  name: string
  slug: string
  cover: string
  coverThumbhash?: string
  /**
   * Empty string when the YAML entry omitted `description`. When present,
   * holds both the compiled MDX body and its plain source — the plain
   * track keeps SEO meta callers single-string while the compiled track
   * powers the categories-listing prose surface.
   */
  description: CategoryDescription | null
  counts: number
  permalink: string
}

export type Tag = {
  name: string
  slug: string
  counts: number
  permalink: string
}

export type Page = {
  title: string
  date: Date
  updated?: Date
  comments: boolean
  cover: string
  coverThumbhash?: string
  og?: string
  published: boolean
  summary: string
  toc: boolean
  slug: string
  permalink: string
  body: MDXContent
  headings: MarkdownHeading[]
  /** Path into the Fumadocs MDX browser collection (e.g. "about.mdx"). */
  mdxPath: string
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
  coverThumbhash?: string
  og?: string
  published: boolean
  visible: boolean
  toc: boolean
  slug: string
  permalink: string
  body: MDXContent
  headings: MarkdownHeading[]
  structuredData: StructuredData
  /** Path into the Fumadocs MDX browser collection (e.g. "2025/2025-01-04-foo.mdx"). */
  mdxPath: string
}

export type ClientPost = Omit<Post, 'body' | 'structuredData' | 'mdxPath'>
export type ClientPage = Omit<Page, 'body' | 'mdxPath'>
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

export function toClientPost(post: Post): ClientPost {
  const { body: _body, structuredData: _structuredData, mdxPath: _mdxPath, ...rest } = post
  return rest
}

export function toClientPage(page: Page): ClientPage {
  const { body: _body, mdxPath: _mdxPath, ...rest } = page
  return rest
}
