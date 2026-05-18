/**
 * Content revision domain — shared primitives for post and page body
 * revisions. Both `post` and `page` own a `content` row chain; this
 * module holds the type definitions that cross the post/page boundary.
 */

export type ContentType = 'page' | 'post'

export interface SaveDraftInput {
  ownerId: bigint
  body: unknown
  imageSources: string[]
  headings: unknown
  authorId: bigint | null
  expectedClientRevisionToken?: string | null
  force?: boolean
}

export type SaveDraftResult =
  | { status: 'saved'; row: import('@/server/infra/db/types').ContentRow }
  | { status: 'conflict'; latest: import('@/server/infra/db/types').ContentRow; expectedToken: string }

export interface PublishLatestInput extends SaveDraftInput {
  publishedAt?: Date
}

export type PublishLatestResult =
  | { status: 'published'; row: import('@/server/infra/db/types').ContentRow }
  | { status: 'conflict'; latest: import('@/server/infra/db/types').ContentRow; expectedToken: string }
