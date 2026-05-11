import type { PortableTextBody } from '@/pt/schema'
import type { MarkdownHeading } from '@/shared/toc'

export interface AdminPostDto {
  id: string
  slug: string
  title: string
  summary: string
  cover: string
  og: string | null
  published: boolean
  commentsEnabled: boolean
  showToc: boolean
  /**
   * Opt the post into rendering「修改于 XXXX」next to the first-publish
   * date on the public detail page. Toggled from the editor meta sidebar
   * (next to the TOC toggle); defaults `false`.
   */
  showUpdated: boolean
  visible: boolean
  publishedAt: string
  publishedRevisionId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  category: string
  tags: string[]
  alias: string[]
  authorId: string | null
  authorName: string | null
  pinnedAt: string | null
  /** Null until the first successful publish. */
  firstPublishedAt: string | null
}

export interface AdminRevisionDto {
  id: string
  revisionNo: number
  status: 'draft' | 'published'
  body: PortableTextBody
  imageSources: string[]
  headings: MarkdownHeading[]
  authorId: string | null
  clientRevisionToken: string
  createdAt: string
  updatedAt: string
}

export interface AdminPostDetailDto {
  post: AdminPostDto
  latestRevision: AdminRevisionDto | null
  publishedRevision: AdminRevisionDto | null
}

export interface ListPostsInput {
  q?: string
  deletedStatus?: 'all' | 'deleted' | 'normal'
  offset?: number
  limit?: number
  category?: string
  tag?: string
  published?: boolean
  visible?: boolean
  sortBy?: 'publishedAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  authorId?: string
}

export interface ListPostsOutput {
  posts: AdminPostDto[]
  total: number
  hasMore: boolean
}

export interface GetPostInput {
  id: string
}

export type GetPostOutput = AdminPostDetailDto | null

export interface ListPostRevisionsInput {
  id: string
}

export interface ListPostRevisionsOutput {
  revisions: AdminRevisionDto[]
}

export interface UpsertPostMetaInput {
  id?: string
  slug?: string
  title: string
  summary?: string
  cover?: string
  og?: string | null
  published?: boolean
  commentsEnabled?: boolean
  showToc?: boolean
  /**
   * Toggle the「修改于 XXXX」secondary timestamp on the public detail
   * page. Defaults `false` on create.
   */
  showUpdated?: boolean
  visible?: boolean
  publishedAt?: string
  category?: string
  tags?: string[]
  alias?: string[]
  pinnedAt?: string | null
}

export interface UpsertPostMetaOutput {
  post: AdminPostDto
}

export interface DeletePostInput {
  id: string
}

export interface DeletePostOutput {
  success: true
}

export interface RestorePostInput {
  id: string
}

export interface RestorePostOutput {
  success: true
}

export interface UnpublishPostInput {
  id: string
}

export interface UnpublishPostOutput {
  post: AdminPostDto
}

export interface SavePostBodyInput {
  id: string
  body: PortableTextBody
  expectedClientRevisionToken?: string | null
  force?: boolean
  publishedAt?: string
}

export type SavePostBodyOutput =
  | { status: 'saved'; revision: AdminRevisionDto }
  | { status: 'conflict'; latest: AdminRevisionDto; expectedToken: string }

export interface PreviewPostBodyInput {
  body: PortableTextBody
}

export interface PreviewPostBodyOutput {
  html: string
  headings: MarkdownHeading[]
}
