import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { AdminTagsListFilters } from '@/server/db/query/tag'
import type { CategoryRow, TagRow } from '@/server/db/types'

import { adminSession } from './_helpers/session'

// Drive the admin Resource Routes for `/api/actions/admin/{list,upsert,delete}{Category,Tag}`
// end-to-end through the actual `defineApiAction` perimeter. We mock
// only the leaf modules (`@/server/db/query/*`, `@/server/catalog`)
// so the real schema validation, slug derivation, uniqueness guard,
// and `ContentCatalog.reset()` invocation all execute under the test.
//
// The 6 endpoints share the same shape, so we cover:
//   - list returns the rows + total count from the query helper;
//   - upsert (create) inserts a new row, derives a tag slug from
//     pinyin when blank, and resets the catalog;
//   - upsert (update) round-trips through `findById` + `updateRow`;
//   - delete blocks (409) when posts still reference the taxonomy;
//   - delete succeeds when no post references the row;
//   - delete returns 404 when the row is missing.

const queryCategoryMock = {
  listAdminCategoryRows: vi.fn<() => Promise<CategoryRow[]>>(),
  findCategoryById: vi.fn<(id: bigint) => Promise<CategoryRow | null>>(),
  findCategoryByName: vi.fn<(name: string) => Promise<CategoryRow | null>>(),
  findCategoryBySlug: vi.fn<(slug: string) => Promise<CategoryRow | null>>(),
  insertCategory: vi.fn<(values: Partial<CategoryRow>) => Promise<CategoryRow>>(),
  updateCategory: vi.fn<(id: bigint, values: Partial<CategoryRow>) => Promise<CategoryRow | null>>(),
  deleteCategory: vi.fn<(id: bigint) => Promise<boolean>>(),
  listPublicCategoryRows: vi.fn<() => Promise<CategoryRow[]>>(),
  reorderCategories: vi.fn<(orderedIds: readonly bigint[]) => Promise<CategoryRow[]>>(),
  seedCategoryIfMissing: vi.fn<() => Promise<boolean>>(async () => true),
}

vi.mock('@/server/db/query/category', () => queryCategoryMock)

const queryTagMock = {
  // Signature mirrors the real export; tests that don't care about
  // the filter argument can still call `mockResolvedValueOnce(rows)`,
  // and tests that need to assert on the forwarded `offset`/`limit`
  // (the pagination case below) can use `mockImplementationOnce`.
  listAdminTagRows: vi.fn<(filters?: AdminTagsListFilters) => Promise<TagRow[]>>(),
  countAdminTags: vi.fn<(filters?: AdminTagsListFilters) => Promise<number>>(),
  findTagById: vi.fn<(id: bigint) => Promise<TagRow | null>>(),
  findTagByName: vi.fn<(name: string) => Promise<TagRow | null>>(),
  findTagBySlug: vi.fn<(slug: string) => Promise<TagRow | null>>(),
  insertTag: vi.fn<(values: Partial<TagRow>) => Promise<TagRow>>(),
  updateTag: vi.fn<(id: bigint, values: Partial<TagRow>) => Promise<TagRow | null>>(),
  deleteTag: vi.fn<(id: bigint) => Promise<boolean>>(),
  listPublicTagRows: vi.fn<() => Promise<TagRow[]>>(),
  seedTagIfMissing: vi.fn<() => Promise<boolean>>(async () => true),
}

vi.mock('@/server/db/query/tag', () => queryTagMock)

// `deleteAdmin{Category,Tag}` consults `listPostsByCategory` / `listPostsByTag`
// to check post-references. Mock them so each test can declare which posts
// still reference the row under test.
const catalogState = {
  postsByCategory: new Map<string, { title: string }[]>(),
  postsByTag: new Map<string, { title: string }[]>(),
}

vi.mock('@/server/posts/query', () => ({
  listPostsByCategory: vi.fn(async (name: string) => catalogState.postsByCategory.get(name) ?? []),
  listPostsByTag: vi.fn(async (name: string) => catalogState.postsByTag.get(name) ?? []),
}))

const { makeLoaderArgs } = await import('./_helpers/context')

const ADMIN_ARGS = (request: Request) => makeLoaderArgs({ request, session: adminSession() })

const NOW = new Date('2026-05-02T00:00:00.000Z')

function makeCategoryRow(overrides: Partial<CategoryRow> = {}): CategoryRow {
  return {
    id: 1n,
    createdAt: NOW,
    updatedAt: NOW,
    name: '技术',
    slug: 'tech',
    cover: 'https://cdn.example.com/cover.jpg',
    description: '',
    sortOrder: 0,
    ...overrides,
  }
}

function makeTagRow(overrides: Partial<TagRow> = {}): TagRow {
  return {
    id: 10n,
    createdAt: NOW,
    updatedAt: NOW,
    name: 'TypeScript',
    slug: 'typescript',
    ...overrides,
  }
}

beforeEach(() => {
  for (const mock of Object.values(queryCategoryMock)) {
    mock.mockReset()
  }
  for (const mock of Object.values(queryTagMock)) {
    mock.mockReset()
  }
  queryCategoryMock.seedCategoryIfMissing.mockImplementation(async () => true)
  queryTagMock.seedTagIfMissing.mockImplementation(async () => true)
  catalogState.postsByCategory = new Map()
  catalogState.postsByTag = new Map()
})

describe('routes/api/actions/admin.listCategories', () => {
  it('returns the admin DTO list and total count from the query helper', async () => {
    const row = makeCategoryRow()
    queryCategoryMock.listAdminCategoryRows.mockResolvedValueOnce([row])
    // The service projects `postCount` from the live catalog. Two
    // posts referencing `技术` should surface as `postCount: 2` in
    // the response.
    catalogState.postsByCategory.set('技术', [{ title: 'Post A' }, { title: 'Post B' }])

    const { loader } = await import('@/routes/api/actions/admin.listCategories')
    const response = await loader(ADMIN_ARGS(new Request('http://localhost/api/actions/admin/listCategories')))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      data: {
        categories: [
          {
            id: '1',
            name: '技术',
            slug: 'tech',
            cover: 'https://cdn.example.com/cover.jpg',
            description: '',
            sortOrder: 0,
            postCount: 2,
            createdAt: NOW.toISOString(),
            updatedAt: NOW.toISOString(),
          },
        ],
        total: 1,
      },
    })
  })

  it('reports postCount: 0 for a category no post references', async () => {
    queryCategoryMock.listAdminCategoryRows.mockResolvedValueOnce([makeCategoryRow({ id: 9n, name: '空' })])

    const { loader } = await import('@/routes/api/actions/admin.listCategories')
    const response = await loader(ADMIN_ARGS(new Request('http://localhost/api/actions/admin/listCategories')))

    const body = (await response.json()) as { data: { categories: { name: string; postCount: number }[] } }
    expect(body.data.categories).toHaveLength(1)
    expect(body.data.categories[0]).toMatchObject({ name: '空', postCount: 0 })
  })

  it('forwards the q query param to the listAdminCategoryRows filter', async () => {
    queryCategoryMock.listAdminCategoryRows.mockResolvedValueOnce([])

    const { loader } = await import('@/routes/api/actions/admin.listCategories')
    await loader(ADMIN_ARGS(new Request('http://localhost/api/actions/admin/listCategories?q=tech')))

    expect(queryCategoryMock.listAdminCategoryRows).toHaveBeenCalledWith({ q: 'tech' })
  })
})

describe('routes/api/actions/admin.upsertCategory', () => {
  it('creates a new category and resets the catalog', async () => {
    queryCategoryMock.findCategoryByName.mockResolvedValueOnce(null)
    queryCategoryMock.findCategoryBySlug.mockResolvedValueOnce(null)
    queryCategoryMock.insertCategory.mockResolvedValueOnce(makeCategoryRow({ id: 5n, name: 'New', slug: 'new' }))

    const { action } = await import('@/routes/api/actions/admin.upsertCategory')
    const response = await action(
      ADMIN_ARGS(
        new Request('http://localhost/api/actions/admin/upsertCategory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'New',
            slug: 'new',
            cover: 'https://cdn.example.com/c.jpg',
            description: 'about',
          }),
        }),
      ),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: { category: { id: string; name: string } } }
    expect(body.data.category.name).toBe('New')
  })

  it('rejects a create with a duplicate name (HTTP 409 + Zod-style issue)', async () => {
    queryCategoryMock.findCategoryByName.mockResolvedValueOnce(makeCategoryRow({ id: 99n, name: 'New' }))

    const { action } = await import('@/routes/api/actions/admin.upsertCategory')
    const response = await action(
      ADMIN_ARGS(
        new Request('http://localhost/api/actions/admin/upsertCategory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New', slug: 'new', cover: 'https://cdn.example.com/c.jpg' }),
        }),
      ),
    )

    expect(response.status).toBe(409)
    const body = (await response.json()) as { error: { message: string; issues?: unknown[] } }
    expect(body.error.message).toContain('已存在同名分类')
    expect(body.error.issues?.length ?? 0).toBeGreaterThan(0)
  })

  it('updates an existing category by id', async () => {
    queryCategoryMock.findCategoryById.mockResolvedValueOnce(makeCategoryRow({ id: 7n, name: 'Old', slug: 'old' }))
    // No name/slug rename in this test, so the duplicate-check fast paths skip.
    queryCategoryMock.updateCategory.mockResolvedValueOnce(
      makeCategoryRow({ id: 7n, name: 'Old', slug: 'old', sortOrder: 5 }),
    )

    const { action } = await import('@/routes/api/actions/admin.upsertCategory')
    const response = await action(
      ADMIN_ARGS(
        new Request('http://localhost/api/actions/admin/upsertCategory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: '7',
            name: 'Old',
            slug: 'old',
            cover: 'https://cdn.example.com/c.jpg',
            sortOrder: 5,
          }),
        }),
      ),
    )

    expect(response.status).toBe(200)
    expect(queryCategoryMock.updateCategory).toHaveBeenCalledWith(7n, expect.objectContaining({ sortOrder: 5 }))
  })
})

describe('routes/api/actions/admin.deleteCategory', () => {
  it('refuses (409) when posts still reference the category and lists their titles', async () => {
    queryCategoryMock.findCategoryById.mockResolvedValueOnce(makeCategoryRow({ id: 3n, name: '技术' }))
    catalogState.postsByCategory.set('技术', [{ title: 'Post A' }, { title: 'Post B' }])

    const { action } = await import('@/routes/api/actions/admin.deleteCategory')
    const response = await action(
      ADMIN_ARGS(
        new Request('http://localhost/api/actions/admin/deleteCategory', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: '3' }),
        }),
      ),
    )

    expect(response.status).toBe(409)
    const body = (await response.json()) as { error: { message: string } }
    expect(body.error.message).toContain('Post A')
    expect(body.error.message).toContain('Post B')
    expect(queryCategoryMock.deleteCategory).not.toHaveBeenCalled()
  })

  it('deletes when no post references the category', async () => {
    queryCategoryMock.findCategoryById.mockResolvedValueOnce(makeCategoryRow({ id: 4n, name: '空' }))
    queryCategoryMock.deleteCategory.mockResolvedValueOnce(true)

    const { action } = await import('@/routes/api/actions/admin.deleteCategory')
    const response = await action(
      ADMIN_ARGS(
        new Request('http://localhost/api/actions/admin/deleteCategory', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: '4' }),
        }),
      ),
    )

    expect(response.status).toBe(200)
    expect(queryCategoryMock.deleteCategory).toHaveBeenCalledWith(4n)
  })

  it('returns 404 when the row does not exist', async () => {
    queryCategoryMock.findCategoryById.mockResolvedValueOnce(null)

    const { action } = await import('@/routes/api/actions/admin.deleteCategory')
    const response = await action(
      ADMIN_ARGS(
        new Request('http://localhost/api/actions/admin/deleteCategory', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: '99' }),
        }),
      ),
    )

    expect(response.status).toBe(404)
  })
})

describe('routes/api/actions/admin.reorderCategories', () => {
  it('rewrites sort_order to match the submitted id sequence and returns the fresh DTOs', async () => {
    const live = [
      makeCategoryRow({ id: 1n, name: '技术', slug: 'tech', sortOrder: 0 }),
      makeCategoryRow({ id: 2n, name: '生活', slug: 'life', sortOrder: 1 }),
      makeCategoryRow({ id: 3n, name: '随笔', slug: 'misc', sortOrder: 2 }),
    ]
    queryCategoryMock.listPublicCategoryRows.mockResolvedValueOnce(live)
    queryCategoryMock.reorderCategories.mockImplementationOnce(async (ids) =>
      ids.map((id, index) => {
        const match = live.find((row) => row.id === id)
        if (!match) {
          throw new Error(`unexpected id ${String(id)} in test reorder mock`)
        }
        return { ...match, sortOrder: index }
      }),
    )

    const { action } = await import('@/routes/api/actions/admin.reorderCategories')
    const response = await action(
      ADMIN_ARGS(
        new Request('http://localhost/api/actions/admin/reorderCategories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds: ['3', '1', '2'] }),
        }),
      ),
    )

    expect(response.status).toBe(200)
    expect(queryCategoryMock.reorderCategories).toHaveBeenCalledWith([3n, 1n, 2n])
    const body = (await response.json()) as { data: { categories: { id: string; sortOrder: number }[] } }
    expect(body.data.categories.map((row) => [row.id, row.sortOrder])).toEqual([
      ['3', 0],
      ['1', 1],
      ['2', 2],
    ])
  })

  it('rejects (409) when the submitted id set does not match the live row set', async () => {
    queryCategoryMock.listPublicCategoryRows.mockResolvedValueOnce([
      makeCategoryRow({ id: 1n }),
      makeCategoryRow({ id: 2n }),
      makeCategoryRow({ id: 3n }),
    ])

    const { action } = await import('@/routes/api/actions/admin.reorderCategories')
    const response = await action(
      ADMIN_ARGS(
        // Missing id `3` — live has 3 rows but request only ships 2.
        new Request('http://localhost/api/actions/admin/reorderCategories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds: ['1', '2'] }),
        }),
      ),
    )

    expect(response.status).toBe(409)
    expect(queryCategoryMock.reorderCategories).not.toHaveBeenCalled()
  })

  it('rejects (400) when orderedIds contains duplicates', async () => {
    const { action } = await import('@/routes/api/actions/admin.reorderCategories')
    const response = await action(
      ADMIN_ARGS(
        new Request('http://localhost/api/actions/admin/reorderCategories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds: ['1', '2', '1'] }),
        }),
      ),
    )

    expect(response.status).toBe(400)
    expect(queryCategoryMock.listPublicCategoryRows).not.toHaveBeenCalled()
    expect(queryCategoryMock.reorderCategories).not.toHaveBeenCalled()
  })
})

describe('routes/api/actions/admin.listTags', () => {
  it('returns each tag with its postCount projected from the catalog', async () => {
    queryTagMock.listAdminTagRows.mockResolvedValueOnce([
      makeTagRow({ id: 30n, name: 'TypeScript', slug: 'typescript' }),
      makeTagRow({ id: 31n, name: 'orphan', slug: 'orphan' }),
    ])
    queryTagMock.countAdminTags.mockResolvedValueOnce(2)
    catalogState.postsByTag.set('TypeScript', [{ title: 'A' }, { title: 'B' }, { title: 'C' }])

    const { loader } = await import('@/routes/api/actions/admin.listTags')
    const response = await loader(ADMIN_ARGS(new Request('http://localhost/api/actions/admin/listTags')))

    const body = (await response.json()) as {
      data: { tags: { name: string; postCount: number }[]; total: number; hasMore: boolean }
    }
    expect(body.data.total).toBe(2)
    expect(body.data.hasMore).toBe(false)
    expect(body.data.tags).toEqual([
      expect.objectContaining({ name: 'TypeScript', postCount: 3 }),
      expect.objectContaining({ name: 'orphan', postCount: 0 }),
    ])
  })

  it('paginates server-side: forwards offset/limit and reports hasMore from the COUNT(*)', async () => {
    // The action is GET so `offset` / `limit` arrive as query
    // strings; the schema's `z.coerce.number()` is what makes them
    // round-trip through `URL.searchParams.get(...)` cleanly. The
    // service then projects `total` from `countAdminTags` (which
    // ignores offset/limit) so the client can render the right
    // number of pagination buttons.
    queryTagMock.listAdminTagRows.mockImplementationOnce(async (filters) => {
      // Sanity: the action forwards the query-string values through
      // to the query helper unchanged.
      expect(filters).toEqual(expect.objectContaining({ offset: 20, limit: 10 }))
      return [makeTagRow({ id: 99n, name: 'z-page', slug: 'z-page' })]
    })
    queryTagMock.countAdminTags.mockResolvedValueOnce(35)

    const { loader } = await import('@/routes/api/actions/admin.listTags')
    const response = await loader(
      ADMIN_ARGS(new Request('http://localhost/api/actions/admin/listTags?offset=20&limit=10')),
    )

    const body = (await response.json()) as {
      data: { tags: { name: string }[]; total: number; hasMore: boolean }
    }
    // total is the full filtered count, independent of the page slice
    expect(body.data.total).toBe(35)
    // 20 + 1 < 35 → another page exists
    expect(body.data.hasMore).toBe(true)
    expect(body.data.tags).toEqual([expect.objectContaining({ name: 'z-page' })])
  })
})

describe('routes/api/actions/admin.upsertTag', () => {
  it('derives the slug via pinyin-pro when the request omits it', async () => {
    queryTagMock.findTagByName.mockResolvedValueOnce(null)
    queryTagMock.findTagBySlug.mockResolvedValueOnce(null)
    queryTagMock.insertTag.mockImplementationOnce(async (values) =>
      makeTagRow({ id: 11n, name: values.name as string, slug: values.slug as string }),
    )

    const { action } = await import('@/routes/api/actions/admin.upsertTag')
    const response = await action(
      ADMIN_ARGS(
        new Request('http://localhost/api/actions/admin/upsertTag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '编程' }),
        }),
      ),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: { tag: { name: string; slug: string } } }
    expect(body.data.tag.name).toBe('编程')
    // pinyin-pro -> "bian-cheng"
    expect(body.data.tag.slug).toBe('bian-cheng')
  })

  it('uses an explicit slug when provided', async () => {
    queryTagMock.findTagByName.mockResolvedValueOnce(null)
    queryTagMock.findTagBySlug.mockResolvedValueOnce(null)
    queryTagMock.insertTag.mockImplementationOnce(async (values) =>
      makeTagRow({ id: 12n, name: values.name as string, slug: values.slug as string }),
    )

    const { action } = await import('@/routes/api/actions/admin.upsertTag')
    await action(
      ADMIN_ARGS(
        new Request('http://localhost/api/actions/admin/upsertTag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'TypeScript', slug: 'typescript' }),
        }),
      ),
    )

    expect(queryTagMock.insertTag).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'TypeScript', slug: 'typescript' }),
    )
  })
})

describe('routes/api/actions/admin.deleteTag', () => {
  it('refuses (409) when posts still reference the tag', async () => {
    queryTagMock.findTagById.mockResolvedValueOnce(makeTagRow({ id: 20n, name: 'TypeScript' }))
    catalogState.postsByTag.set('TypeScript', [{ title: 'TS Post' }])

    const { action } = await import('@/routes/api/actions/admin.deleteTag')
    const response = await action(
      ADMIN_ARGS(
        new Request('http://localhost/api/actions/admin/deleteTag', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: '20' }),
        }),
      ),
    )

    expect(response.status).toBe(409)
    expect(queryTagMock.deleteTag).not.toHaveBeenCalled()
  })

  it('deletes orphaned tags', async () => {
    queryTagMock.findTagById.mockResolvedValueOnce(makeTagRow({ id: 21n, name: 'orphan' }))
    queryTagMock.deleteTag.mockResolvedValueOnce(true)

    const { action } = await import('@/routes/api/actions/admin.deleteTag')
    const response = await action(
      ADMIN_ARGS(
        new Request('http://localhost/api/actions/admin/deleteTag', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: '21' }),
        }),
      ),
    )

    expect(response.status).toBe(200)
    expect(queryTagMock.deleteTag).toHaveBeenCalledWith(21n)
  })
})
