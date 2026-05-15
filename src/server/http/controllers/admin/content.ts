import type { PortableTextBody } from '@/shared/pt/schema'

// Shared types for post and page controllers. Posts and pages share the same
// API surface (list, get, upsertMeta, delete, restore, revisions, draft,
// publish, unpublish, preview) with nearly identical handler logic.
// These interfaces eliminate the 70% duplication between the two controllers.

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
