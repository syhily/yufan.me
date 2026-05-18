import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { PostMetaRow } from '@/server/infra/db/types'

// Mock repo lookups so validation branches can be exercised without Postgres.
vi.mock('@/server/domains/posts/repo', () => ({
  findPostMetaById: vi.fn(),
  findPostMetaBySlug: vi.fn(),
  findPublicPostMetaBySlug: vi.fn(),
}))

// Mock the Drizzle transaction so `createPost` / `updatePostMeta` can run
// without a real DB pool.
const txMocks = vi.hoisted(() => {
  const insertReturning = vi.fn<() => unknown[]>(() => [])
  const insertValues = vi.fn(() => ({ returning: insertReturning }))
  const insert = vi.fn(() => ({ values: insertValues }))

  const updateReturning = vi.fn<() => unknown[]>(() => [])
  const updateWhere = vi.fn(() => ({ returning: updateReturning }))
  const updateSet = vi.fn(() => ({ where: updateWhere }))
  const update = vi.fn(() => ({ set: updateSet }))

  return {
    insert,
    insertValues,
    insertReturning,
    update,
    updateSet,
    updateWhere,
    updateReturning,
  }
})

vi.mock('@/server/infra/db/pool', () => ({
  db: {
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        insert: txMocks.insert,
        update: txMocks.update,
      }),
    ),
  },
}))

// Prevent `invalidateCatalog` from throwing because no listeners are registered.
vi.mock(import('@/server/domains/catalog/invalidate'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    invalidateCatalog: vi.fn(),
  }
})

const repo = await import('@/server/domains/posts/repo')
// DomainError not needed for these assertions
const service = await import('@/server/domains/posts/service')

function metaRow(overrides: Partial<PostMetaRow> = {}): PostMetaRow {
  const now = overrides.createdAt ?? new Date('2026-05-01T00:00:00.000Z')
  return {
    id: overrides.id ?? 1n,
    slug: overrides.slug ?? 'hello-world',
    title: overrides.title ?? 'Hello World',
    summary: overrides.summary ?? '',
    cover: overrides.cover ?? '',
    og: overrides.og ?? null,
    published: overrides.published ?? false,
    commentsEnabled: overrides.commentsEnabled ?? true,
    showToc: overrides.showToc ?? false,
    showUpdated: overrides.showUpdated ?? false,
    visible: overrides.visible ?? true,
    publishedAt: overrides.publishedAt ?? now,
    publishedRevisionId: overrides.publishedRevisionId ?? null,
    firstPublishedAt: overrides.firstPublishedAt ?? null,
    authorId: overrides.authorId ?? null,
    createdAt: now,
    updatedAt: overrides.updatedAt ?? now,
    deletedAt: overrides.deletedAt ?? null,
    pinnedAt: overrides.pinnedAt ?? null,
    category: overrides.category ?? '',
    tags: overrides.tags ?? [],
    alias: overrides.alias ?? [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  txMocks.insertReturning.mockReturnValue([])
  txMocks.updateReturning.mockReturnValue([])
})

describe('cms/posts/service — createPost published guard', () => {
  it('always creates with published=false even when input says true', async () => {
    vi.mocked(repo.findPostMetaBySlug).mockResolvedValue(null)
    txMocks.insertReturning.mockReturnValue([metaRow({ slug: 'test', published: false })])

    await service.createPost({ title: 'Test', published: true }, null)

    const valuesCall = txMocks.insertValues.mock.calls[0] as unknown as [Record<string, unknown>] | undefined
    expect(valuesCall).toBeDefined()
    expect(valuesCall![0].published).toBe(false)
  })

  it('creates with published=false when input omits the field', async () => {
    vi.mocked(repo.findPostMetaBySlug).mockResolvedValue(null)
    txMocks.insertReturning.mockReturnValue([metaRow({ slug: 'test', published: false })])

    await service.createPost({ title: 'Test' }, null)

    const valuesCall = txMocks.insertValues.mock.calls[0] as unknown as [Record<string, unknown>] | undefined
    expect(valuesCall).toBeDefined()
    expect(valuesCall![0].published).toBe(false)
  })
})

describe('cms/posts/service — updatePostMeta ignores published', () => {
  it('leaves existing published=true untouched even when input says false', async () => {
    vi.mocked(repo.findPostMetaById).mockResolvedValue(metaRow({ id: 7n, slug: 'hello-world', published: true }))
    vi.mocked(repo.findPostMetaBySlug).mockResolvedValue(null)
    txMocks.updateReturning.mockReturnValue([
      metaRow({ id: 7n, slug: 'hello-world', published: true, title: 'Updated' }),
    ])

    const dto = await service.updatePostMeta({ id: 7n, slug: 'hello-world', title: 'Updated', published: false })
    expect(dto.title).toBe('Updated')

    const setCall = txMocks.updateSet.mock.calls[0] as unknown as [Record<string, unknown>] | undefined
    expect(setCall).toBeDefined()
    expect(setCall![0]).not.toHaveProperty('published')
  })

  it('leaves existing published=false untouched even when input says true', async () => {
    vi.mocked(repo.findPostMetaById).mockResolvedValue(metaRow({ id: 7n, slug: 'hello-world', published: false }))
    vi.mocked(repo.findPostMetaBySlug).mockResolvedValue(null)
    txMocks.updateReturning.mockReturnValue([
      metaRow({ id: 7n, slug: 'hello-world', published: false, title: 'Updated' }),
    ])

    const dto = await service.updatePostMeta({ id: 7n, slug: 'hello-world', title: 'Updated', published: true })
    expect(dto.title).toBe('Updated')

    const setCall = txMocks.updateSet.mock.calls[0] as unknown as [Record<string, unknown>] | undefined
    expect(setCall).toBeDefined()
    expect(setCall![0]).not.toHaveProperty('published')
  })
})
