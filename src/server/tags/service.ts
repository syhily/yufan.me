import type { TagRow } from '@/server/db/types'
import type { AdminTagDto } from '@/shared/tags'

import { hasAtLeast, type Role } from '@/server/auth/rbac'
import { invalidateCatalog } from '@/server/catalog/invalidate'
import {
  type AdminTagsListFilters,
  countAdminTags,
  deleteTag as deleteTagRow,
  findTagById,
  findTagByName,
  findTagBySlug,
  insertTag,
  listAdminTagRows,
  updateTag,
} from '@/server/db/query/tag'
import { listPostsByTag } from '@/server/posts/query'
import { ActionFailure } from '@/server/route-helpers/api-handler'
import { ErrorMessages } from '@/server/route-helpers/errors'
import {
  deleteAdminTaxonomy,
  ensureUniqueOnCreateTaxonomy,
  ensureUniqueOnUpdateTaxonomy,
  resolveSlugForTaxonomy,
} from '@/server/taxonomies/service'

// Wire-format DTO for every admin tag endpoint. `postCount` is
// projected by the caller from the live `ContentCatalog` (mirrors
// the category service shape). See `tagPostCounter`.
export function toAdminTagDto(row: TagRow, postCount: number): AdminTagDto {
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    postCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export interface AdminTagsListResult {
  tags: AdminTagDto[]
  total: number
  /** True when `offset + rows.length < total` (i.e. another page exists). */
  hasMore: boolean
}

// Single catalog snapshot + per-row map lookup. Counts include
// hidden + scheduled posts so the column matches what the
// delete-block guard sees.
async function tagPostCounter(): Promise<(name: string) => Promise<number>> {
  return async (name: string) => {
    const posts = await listPostsByTag(name, { includeHidden: true, includeScheduled: true })
    return posts.length
  }
}

// Server-side pagination: parallel `[rows, total, postCounter]` so we
// pay only one round-trip for the page-of-rows query, the COUNT(*),
// and the catalog snapshot. `total` is the full filtered count
// (independent of `offset`/`limit`) so the client can render the
// correct number of pagination buttons.
export async function listTagsForAdmin(filters: AdminTagsListFilters): Promise<AdminTagsListResult> {
  const offset = filters.offset ?? 0
  const [rows, total, countOf] = await Promise.all([
    listAdminTagRows(filters),
    countAdminTags({ q: filters.q }),
    tagPostCounter(),
  ])
  return {
    tags: await Promise.all(rows.map(async (row) => toAdminTagDto(row, await countOf(row.name)))),
    total,
    hasMore: offset + rows.length < total,
  }
}

export interface UpsertTagInputs {
  id?: bigint
  name: string
  slug?: string
}

export interface TagViewerContext {
  userId: string
  role: Role
}

export async function upsertAdminTag(input: UpsertTagInputs, viewer?: TagViewerContext): Promise<AdminTagDto> {
  const slug = resolveSlugForTaxonomy(input.slug, input.name)

  if (input.id === undefined) {
    await ensureUniqueOnCreateTaxonomy(findTagByName, findTagBySlug, input.name, slug, '标签')
    const row = await insertTag({ name: input.name, slug })
    invalidateCatalog('taxonomy')
    const countOf = await tagPostCounter()
    return toAdminTagDto(row, await countOf(row.name))
  }

  // Authors may only create tags; renaming is admin-only.
  if (viewer && !hasAtLeast(viewer.role, 'admin')) {
    throw new ActionFailure(403, ErrorMessages.FORBIDDEN)
  }

  const existing = await findTagById(input.id)
  if (existing === null) {
    throw new ActionFailure(404, '标签不存在')
  }
  await ensureUniqueOnUpdateTaxonomy(
    findTagByName,
    findTagBySlug,
    input.id,
    input.name,
    existing.name,
    slug,
    existing.slug,
    '标签',
  )
  const updated = await updateTag(input.id, { name: input.name, slug })
  if (updated === null) {
    throw new ActionFailure(404, '标签不存在')
  }
  invalidateCatalog('taxonomy')
  const countOf = await tagPostCounter()
  return toAdminTagDto(updated, await countOf(updated.name))
}

// Block-only deletion regardless of role. `deleteAdminTaxonomy` refuses
// to remove a tag while any post still lists it in its frontmatter
// `tags: [...]` — this is the project's intentional stricter-than-
// RBAC-design fence: we never orphan posts, even when an admin clicks
// delete. Authors get the same UX as admins because the cross-check is
// global to the tag, not the viewer. Same contract as
// `deleteAdminCategory`.
export async function deleteAdminTag(id: bigint, _viewer?: TagViewerContext): Promise<boolean> {
  return deleteAdminTaxonomy(id, '标签', {
    findById: findTagById,
    deleteRow: deleteTagRow,
    listPostsBy: listPostsByTag,
  })
}
