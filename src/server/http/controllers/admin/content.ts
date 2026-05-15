import type { PortableTextBody } from '@/shared/pt/schema'

import { ok } from '@/server/http/response'
import { body } from '@/server/http/ts-rest-adapter'
import { deriveSlug } from '@/server/slug'
import { collectHeadings } from '@/shared/pt/schema'

// Shared types and helpers for post and page controllers. Posts and pages share
// the same API surface (list, get, upsertMeta, delete, restore, revisions,
// draft, publish, unpublish, preview). These interfaces and the shared preview
// handler reduce the ~70% code duplication.

export interface ContentListQuery {
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
  authorId?: bigint
}

export interface ContentDraftBody {
  body: PortableTextBody
  expectedClientRevisionToken?: string | null
  force?: boolean
  publishedAt?: string
}

export interface ContentPreviewBody {
  body: PortableTextBody
}

// Shared preview handler — identical for posts and pages.
export async function contentPreview(
  args: Record<string, unknown>,
  renderer: (body: PortableTextBody) => Promise<string>,
) {
  const b = body<ContentPreviewBody>(args)
  const html = await renderer(b.body)
  const headings = collectHeadings(b.body, deriveSlug)
  return ok({ html, headings })
}
