import type { MarkdownHeading } from '@/shared/catalog'
import type { PortableTextBody } from '@/shared/portable-text'

// Wire-format DTOs and request shapes for the `/wp-admin/pages` editor +
// the `/api/actions/admin.{listPages,…}` resource routes. Lives in
// `@/shared` so server (admin actions, service layer) and client
// (admin UI fetcher hooks) import the same shape without crossing the
// server/client boundary. Bigints are stringified — the public site
// never ships ids; the admin shell uses them as React list keys and
// echoes them back unchanged.

// --- Page metadata wire DTO ------------------------------------------------

export interface AdminPageDto {
  id: string
  slug: string
  title: string
  summary: string
  cover: string
  og: string | null
  published: boolean
  commentsEnabled: boolean
  showToc: boolean
  /** ISO-8601. Editable from the metadata panel. */
  publishedAt: string
  /** `null` while the page has never been published. */
  publishedRevisionId: string | null
  createdAt: string
  updatedAt: string
  /** When non-null the row is soft-deleted. */
  deletedAt: string | null
}

export interface AdminRevisionDto {
  id: string
  revisionNo: number
  status: 'draft' | 'published'
  body: PortableTextBody
  /**
   * Storage paths captured at save time so the storage-GC pass can
   * tell which images each revision still references without
   * re-parsing the body.
   */
  imageSources: string[]
  headings: MarkdownHeading[]
  /** User id of whoever saved this revision. */
  authorId: string | null
  /** Optimistic-concurrency token; client must echo on next save. */
  clientRevisionToken: string
  createdAt: string
  updatedAt: string
}

export interface AdminPageDetailDto {
  page: AdminPageDto
  /** Latest revision (draft preferred over published). */
  latestRevision: AdminRevisionDto | null
  publishedRevision: AdminRevisionDto | null
}

// --- list / get -----------------------------------------------------------

export interface ListPagesInput {
  q?: string
  /** When `true`, soft-deleted rows appear in the listing. */
  includeDeleted?: boolean
  /** Zero-based offset for pagination. */
  offset?: number
  /** Page size; capped server-side. */
  limit?: number
}

export interface ListPagesOutput {
  pages: AdminPageDto[]
  total: number
  hasMore: boolean
}

export interface GetPageInput {
  /** Stringified bigint id (admin DTO field). */
  id: string
}

export type GetPageOutput = AdminPageDetailDto | null

export interface ListPageRevisionsInput {
  id: string
}

export interface ListPageRevisionsOutput {
  revisions: AdminRevisionDto[]
}

// --- create / update meta -------------------------------------------------

// `id` absent → create a new row. Present → update the matching row.
// All optional fields fall back to defaults on create or to existing
// values on update.
export interface UpsertPageMetaInput {
  id?: string
  slug: string
  title: string
  summary?: string
  cover?: string
  og?: string | null
  published?: boolean
  commentsEnabled?: boolean
  showToc?: boolean
  /** ISO-8601 string; admin date-picker sets this on a re-publish. */
  publishedAt?: string
}

export interface UpsertPageMetaOutput {
  page: AdminPageDto
}

// --- delete / restore -----------------------------------------------------

export interface DeletePageInput {
  id: string
}

export interface DeletePageOutput {
  success: true
}

export interface RestorePageInput {
  id: string
}

export interface RestorePageOutput {
  success: true
}

// --- save / publish -------------------------------------------------------

// Save a draft body or publish it atomically. The wire shape is
// identical between the two endpoints — the difference lives in the
// HTTP route and what the server does after the row write.
export interface SavePageBodyInput {
  id: string
  /** PortableText body. Validated by the server perimeter. */
  body: PortableTextBody
  /**
   * Optimistic-concurrency token. When provided and the server's
   * latest revision token differs, the server returns a `conflict`
   * response without writing.
   */
  expectedClientRevisionToken?: string | null
  /** Override the conflict guard. Used by the conflict-resolution UI. */
  force?: boolean
}

export type SavePageBodyOutput =
  | { status: 'saved'; revision: AdminRevisionDto }
  | {
      status: 'conflict'
      latest: AdminRevisionDto
      expectedToken: string
    }

// --- preview --------------------------------------------------------------

// Thin SSR-side render preview. The editor right pane swaps into this
// without saving. Server validates the body but does not persist it.
export interface PreviewPageBodyInput {
  body: PortableTextBody
}

export interface PreviewPageBodyOutput {
  /** Rendered HTML for the preview pane. */
  html: string
  headings: MarkdownHeading[]
}
