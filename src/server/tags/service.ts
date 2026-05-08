import type { TagRow } from '@/server/db/types'
import type { AdminTagDto } from '@/shared/tags'

import { listPostsByTag } from '@/server/catalog'
import { invalidateCatalog } from '@/server/catalog/invalidate'
import { formatBlockMessage } from '@/server/categories/service'
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
import { ActionFailure } from '@/server/route-helpers/api-handler'
import { derivedTagSlug } from '@/server/tags/slug'

export { derivedTagSlug }

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
  return async (name: string) => (await listPostsByTag(name, { includeHidden: true, includeScheduled: true })).length
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

export async function upsertAdminTag(input: UpsertTagInputs): Promise<AdminTagDto> {
  const slug = (input.slug?.trim() ?? '') !== '' ? input.slug!.trim() : derivedTagSlug(input.name)

  if (input.id === undefined) {
    await ensureUniqueOnCreate(input.name, slug)
    const row = await insertTag({ name: input.name, slug })
    invalidateCatalog('taxonomy')
    const countOf = await tagPostCounter()
    return toAdminTagDto(row, await countOf(row.name))
  }

  const existing = await findTagById(input.id)
  if (existing === null) {
    throw new ActionFailure(404, '标签不存在')
  }
  await ensureUniqueOnUpdate(input.id, input.name, existing.name, slug, existing.slug)
  const updated = await updateTag(input.id, { name: input.name, slug })
  if (updated === null) {
    throw new ActionFailure(404, '标签不存在')
  }
  invalidateCatalog('taxonomy')
  const countOf = await tagPostCounter()
  return toAdminTagDto(updated, await countOf(updated.name))
}

// Block-only deletion. Same contract as `deleteAdminCategory`: refuse
// when any post (visible/hidden/scheduled) still lists the tag in its
// frontmatter `tags: [...]`.
export async function deleteAdminTag(id: bigint): Promise<boolean> {
  const existing = await findTagById(id)
  if (existing === null) {
    return false
  }

  const referencing = await listPostsByTag(existing.name, { includeHidden: true, includeScheduled: true })
  if (referencing.length > 0) {
    throw new ActionFailure(
      409,
      formatBlockMessage(
        '标签',
        existing.name,
        referencing.map((post) => post.title),
      ),
    )
  }

  const removed = await deleteTagRow(id)
  if (removed) {
    invalidateCatalog('taxonomy')
  }
  return removed
}

async function ensureUniqueOnCreate(name: string, slug: string): Promise<void> {
  const dupName = await findTagByName(name)
  if (dupName !== null) {
    throw new ActionFailure(409, `已存在同名标签「${name}」`, [{ message: '名称已被占用', path: ['name'] }])
  }
  const dupSlug = await findTagBySlug(slug)
  if (dupSlug !== null) {
    throw new ActionFailure(409, `已存在相同 slug「${slug}」`, [{ message: 'Slug 已被占用', path: ['slug'] }])
  }
}

async function ensureUniqueOnUpdate(
  id: bigint,
  newName: string,
  existingName: string,
  newSlug: string,
  existingSlug: string,
): Promise<void> {
  if (newName !== existingName) {
    const dupName = await findTagByName(newName)
    if (dupName !== null && dupName.id !== id) {
      throw new ActionFailure(409, `已存在同名标签「${newName}」`, [{ message: '名称已被占用', path: ['name'] }])
    }
  }
  if (newSlug !== existingSlug) {
    const dupSlug = await findTagBySlug(newSlug)
    if (dupSlug !== null && dupSlug.id !== id) {
      throw new ActionFailure(409, `已存在相同 slug「${newSlug}」`, [{ message: 'Slug 已被占用', path: ['slug'] }])
    }
  }
}
