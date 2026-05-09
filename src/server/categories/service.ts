import type { CategoryRow } from '@/server/db/types'
import type { AdminCategoryDto } from '@/shared/categories'

import { ContentCatalog } from '@/server/catalog'
import {
  type AdminCategoriesListFilters,
  deleteCategory as deleteCategoryRow,
  findCategoryById,
  findCategoryByName,
  findCategoryBySlug,
  insertCategory,
  listAdminCategoryRows,
  listPublicCategoryRows,
  reorderCategories as reorderCategoryRows,
  updateCategory,
} from '@/server/db/query/category'
import { ActionFailure } from '@/server/route-helpers/api-handler'
import { deriveSlug } from '@/server/slug'

// Wire-format DTO returned by every admin category endpoint. Bigint
// id stringified so the browser bundle never touches BigInt. The
// `postCount` projection is computed by the caller (typically by
// reading `postsByCategory.length` from the live `ContentCatalog`)
// so a single catalog snapshot powers a whole list response without
// re-fetching it once per row.
export function toAdminCategoryDto(row: CategoryRow, postCount: number): AdminCategoryDto {
  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug,
    cover: row.cover,
    description: row.description,
    sortOrder: row.sortOrder,
    postCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export interface AdminCategoriesListResult {
  categories: AdminCategoryDto[]
  total: number
}

// Build a "name -> post count" function from the live catalog. Single
// catalog fetch + per-row map lookup keeps `O(rows)` projection cheap
// even on large lists (the in-process `postsByCategory` map is already
// computed on catalog build). Counts include hidden + scheduled posts
// so the column matches what the delete-block guard sees.
async function categoryPostCounter(): Promise<(name: string) => number> {
  const catalog = await ContentCatalog.get()
  return (name: string) =>
    catalog.getPostsByTaxonomy({ categoryName: name }, { includeHidden: true, includeScheduled: true }).length
}

export async function listCategoriesForAdmin(filters: AdminCategoriesListFilters): Promise<AdminCategoriesListResult> {
  const [rows, countOf] = await Promise.all([listAdminCategoryRows(filters), categoryPostCounter()])
  return { categories: rows.map((row) => toAdminCategoryDto(row, countOf(row.name))), total: rows.length }
}

export interface UpsertCategoryInputs {
  id?: bigint
  name: string
  /**
   * Explicit URL slug. Optional — when omitted (or the empty string),
   * the service derives one via `deriveSlug(name)` (pinyin-pro ->
   * github-slugger), matching the tag flow so admins can rely on
   * "leave blank to auto-derive".
   */
  slug?: string
  cover: string
  description: string
  sortOrder: number
}

// Single entry-point that the admin Resource Route action calls. The
// `id` distinguishes update from create; both create and update enforce
// `UNIQUE (name)` and `UNIQUE (slug)` at the application layer with a
// pre-flight lookup so the editor sees a friendly 409 instead of the
// raw Drizzle constraint error.
export async function upsertAdminCategory(input: UpsertCategoryInputs): Promise<AdminCategoryDto> {
  // Resolve the effective slug: an explicit non-empty value wins, an
  // empty / missing value falls back to the canonical pinyin pipeline
  // applied to the category name. We treat `''` the same as missing
  // because the admin form posts an empty string when the input is
  // cleared (Zod has already trimmed by the time we land here).
  const slug = resolveSlugForCategory(input.slug, input.name)

  if (input.id === undefined) {
    await ensureUniqueOnCreate(input.name, slug)
    const row = await insertCategory({
      name: input.name,
      slug,
      cover: input.cover,
      description: input.description,
      sortOrder: input.sortOrder,
    })
    const countOf = await categoryPostCounter()
    return toAdminCategoryDto(row, countOf(row.name))
  }

  const existing = await findCategoryById(input.id)
  if (existing === null) {
    throw new ActionFailure(404, '分类不存在')
  }
  await ensureUniqueOnUpdate(input.id, input.name, existing.name, slug, existing.slug)
  const updated = await updateCategory(input.id, {
    name: input.name,
    slug,
    cover: input.cover,
    description: input.description,
    sortOrder: input.sortOrder,
  })
  if (updated === null) {
    throw new ActionFailure(404, '分类不存在')
  }
  const countOf = await categoryPostCounter()
  return toAdminCategoryDto(updated, countOf(updated.name))
}

function resolveSlugForCategory(explicit: string | undefined, name: string): string {
  if (typeof explicit === 'string' && explicit.trim() !== '') {
    return explicit.trim()
  }
  const derived = deriveSlug(name)
  if (derived === '') {
    // `deriveSlug` strips everything to ASCII alphanumerics + dashes;
    // a name made entirely of punctuation / emoji can collapse to an
    // empty string. Refuse the save with a friendly hint instead of
    // letting the DB throw a NOT NULL violation downstream.
    throw new ActionFailure(400, '无法从名称推导出 slug，请手动填写。', [
      { message: '名称推导出空 slug，请手动填写', path: ['slug'] },
    ])
  }
  return derived
}

// Drag-to-reorder. Validates that the submitted id set matches the
// live row set (no missing ids, no unknown ids) before rewriting any
// `sort_order`, so a stale UI submission cannot silently truncate or
// re-rank rows the admin has not seen. Returns the freshly-ordered
// DTOs so the client reducer can swap state in place.
export async function reorderAdminCategories(orderedIds: readonly string[]): Promise<AdminCategoryDto[]> {
  // Reject duplicates up-front — the bulk update is keyed on `id`, so
  // duplicates would silently collapse to the last index.
  const seen = new Set<string>()
  for (const id of orderedIds) {
    if (seen.has(id)) {
      throw new ActionFailure(400, '排序请求存在重复的分类 id')
    }
    seen.add(id)
  }

  // Compare against the live set. We use `listPublicCategoryRows()`
  // (no filtering) so a search-filtered admin view never accidentally
  // re-orders only the visible subset.
  const liveRows = await listPublicCategoryRows()
  if (liveRows.length !== orderedIds.length) {
    throw new ActionFailure(409, '排序与最新分类列表不一致，请刷新后重试')
  }
  const liveIds = new Set(liveRows.map((row) => String(row.id)))
  for (const id of orderedIds) {
    if (!liveIds.has(id)) {
      throw new ActionFailure(409, '排序与最新分类列表不一致，请刷新后重试')
    }
  }

  const updated = await reorderCategoryRows(orderedIds.map((id) => BigInt(id)))
  const countOf = await categoryPostCounter()
  return updated.map((row) => toAdminCategoryDto(row, countOf(row.name)))
}

// Block-only deletion: refuse to delete a category any post still
// references in its frontmatter. The MDX is the source of truth for
// the `category` field — the admin must change the post's
// frontmatter before the row can be removed, otherwise the next
// catalog build would fail `validateTaxonomies` on cold start. The
// 409 message lists up to 5 referencing post titles so the admin
// knows which files to fix.
export async function deleteAdminCategory(id: bigint): Promise<boolean> {
  const existing = await findCategoryById(id)
  if (existing === null) {
    return false
  }

  const catalog = await ContentCatalog.get()
  const referencing = catalog.getPostsByTaxonomy(
    { categoryName: existing.name },
    { includeHidden: true, includeScheduled: true },
  )
  if (referencing.length > 0) {
    throw new ActionFailure(
      409,
      formatBlockMessage(
        '分类',
        existing.name,
        referencing.map((post) => post.title),
      ),
    )
  }

  return deleteCategoryRow(id)
}

async function ensureUniqueOnCreate(name: string, slug: string): Promise<void> {
  const dupName = await findCategoryByName(name)
  if (dupName !== null) {
    throw new ActionFailure(409, `已存在同名分类「${name}」`, [{ message: '名称已被占用', path: ['name'] }])
  }
  const dupSlug = await findCategoryBySlug(slug)
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
    const dupName = await findCategoryByName(newName)
    if (dupName !== null && dupName.id !== id) {
      throw new ActionFailure(409, `已存在同名分类「${newName}」`, [{ message: '名称已被占用', path: ['name'] }])
    }
  }
  if (newSlug !== existingSlug) {
    const dupSlug = await findCategoryBySlug(newSlug)
    if (dupSlug !== null && dupSlug.id !== id) {
      throw new ActionFailure(409, `已存在相同 slug「${newSlug}」`, [{ message: 'Slug 已被占用', path: ['slug'] }])
    }
  }
}

// Shared with the tag service: format the "still referenced by N
// posts" 409 body.
export function formatBlockMessage(kind: string, name: string, titles: readonly string[]): string {
  const preview = titles.slice(0, 5).join('、')
  const suffix = titles.length > 5 ? `等 ${titles.length} 篇文章` : `${titles.length} 篇文章`
  return `${kind}「${name}」仍被 ${suffix}引用：${preview}。请先在 MDX frontmatter 中改写后再删除。`
}
