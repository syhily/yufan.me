import type { ContentRow, PostMetaRow } from '@/server/db/types'
import type { ClientPost, MarkdownHeading } from '@/shared/catalog'
import type { PortableTextBody } from '@/shared/portable-text'

import { validatePortableTextBody } from '@/shared/portable-text'

// --- Public catalog projection ----------------------------------------------

export interface CmsPost extends ClientPost {
  body: PortableTextBody
  imageSources: string[]
  publishedRevisionId: bigint | null
}

export function toCmsPost(
  meta: PostMetaRow,
  publishedRevision: ContentRow | null,
  options: {
    coverThumbhash?: string
    coverWidth?: number
    coverHeight?: number
  } = {},
): CmsPost {
  const body = publishedRevision !== null ? readBody(publishedRevision.body) : []
  const imageSources = publishedRevision !== null ? readStringArray(publishedRevision.imageSources) : []
  const headings = publishedRevision !== null ? readHeadings(publishedRevision.headings) : []

  return {
    id: String(meta.id),
    title: meta.title,
    date: meta.firstPublishedAt ?? meta.publishedAt,
    /** Public catalog: mirrors `published_at` (publish / schedule), not draft saves. */
    updated: meta.publishedAt,
    comments: meta.commentsEnabled,
    alias: (meta.alias as string[]) ?? [],
    tags: (meta.tags as string[]) ?? [],
    category: meta.category,
    summary: meta.summary,
    cover: meta.cover,
    coverThumbhash: options.coverThumbhash,
    og: meta.og ?? undefined,
    published: meta.published,
    visible: meta.visible,
    toc: meta.showToc,
    slug: meta.slug,
    permalink: `/posts/${meta.slug}`,
    headings,
    body,
    imageSources,
    publishedRevisionId: meta.publishedRevisionId,
    pinnedAt: meta.pinnedAt ?? undefined,
  }
}

// --- Admin projection -------------------------------------------------------

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

export function toAdminPostDto(row: PostMetaRow & { authorName?: string | null }): AdminPostDto {
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    cover: row.cover,
    og: row.og,
    published: row.published,
    commentsEnabled: row.commentsEnabled,
    showToc: row.showToc,
    visible: row.visible,
    publishedAt: row.publishedAt.toISOString(),
    publishedRevisionId: row.publishedRevisionId === null ? null : String(row.publishedRevisionId),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt === null ? null : row.deletedAt.toISOString(),
    category: row.category,
    tags: (row.tags as string[]) ?? [],
    alias: (row.alias as string[]) ?? [],
    authorId: row.authorId === null ? null : String(row.authorId),
    authorName: (row as { authorName?: string | null }).authorName ?? null,
    pinnedAt: row.pinnedAt === null ? null : row.pinnedAt.toISOString(),
    firstPublishedAt: row.firstPublishedAt === null ? null : row.firstPublishedAt.toISOString(),
  }
}

export interface AdminPostDetailDto {
  post: AdminPostDto
  latestRevision: AdminRevisionDto | null
  publishedRevision: AdminRevisionDto | null
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

export function toAdminRevisionDto(row: ContentRow): AdminRevisionDto {
  return {
    id: String(row.id),
    revisionNo: row.revisionNo,
    status: row.status === 'published' ? 'published' : 'draft',
    body: readBody(row.body),
    imageSources: readStringArray(row.imageSources),
    headings: readHeadings(row.headings),
    authorId: row.authorId === null ? null : String(row.authorId),
    clientRevisionToken: row.clientRevisionToken,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// --- jsonb helpers ----------------------------------------------------------

function readBody(value: unknown): PortableTextBody {
  if (value === null || value === undefined) {
    return []
  }
  return validatePortableTextBody(value)
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string')
}

function readHeadings(value: unknown): MarkdownHeading[] {
  if (!Array.isArray(value)) {
    return []
  }
  const out: MarkdownHeading[] = []
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object') {
      continue
    }
    const item = entry as Record<string, unknown>
    if (typeof item.depth !== 'number' || typeof item.text !== 'string') {
      continue
    }
    out.push({
      depth: item.depth,
      text: item.text,
      slug: typeof item.slug === 'string' ? item.slug : '',
    })
  }
  return out
}
