/**
 * Content revision domain — shared primitives for post and page body
 * revisions. Both `post` and `page` own a `content` row chain; this
 * module holds the type definitions that cross the post/page boundary.
 */

import type { ContentRow } from '@/server/infra/db/types'

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
  | { status: 'saved'; row: ContentRow }
  | { status: 'conflict'; latest: ContentRow; expectedToken: string }

export interface PublishLatestInput extends SaveDraftInput {
  publishedAt?: Date
}

export type PublishLatestResult =
  | { status: 'published'; row: ContentRow }
  | { status: 'conflict'; latest: ContentRow; expectedToken: string }

export interface CatalogVisibleMeta {
  deletedAt: Date | null
  published: boolean
  publishedRevisionId: bigint | null
  publishedAt: Date
}

/**
 * Shared visibility gate for both posts and pages. A row is visible in
 * the public catalog when it is not soft-deleted, published, has a
 * published revision attached, and its `publishedAt` is not in the
 * future. Duplicated across `posts/service`, `posts/repo`,
 * `pages/service`, `pages/repo`, and `pages/loader` — all now replaced
 * by this single definition.
 */
export function isCatalogVisible(meta: CatalogVisibleMeta, asOf: Date = new Date()): boolean {
  if (meta.deletedAt !== null) {
    return false
  }
  if (!meta.published) {
    return false
  }
  if (meta.publishedRevisionId === null) {
    return false
  }
  if (meta.publishedAt.getTime() > asOf.getTime()) {
    return false
  }
  return true
}
