import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { like } from '@/server/db/schema'

const orm = vi.hoisted(() => ({
  and: vi.fn((...conditions: unknown[]) => ({ conditions, op: 'and' })),
  eq: vi.fn((left: unknown, right: unknown) => ({ left, op: 'eq', right })),
  isNotNull: vi.fn((column: unknown) => ({ column, op: 'isNotNull' })),
  isNull: vi.fn((column: unknown) => ({ column, op: 'isNull' })),
  lt: vi.fn((left: unknown, right: unknown) => ({ left, op: 'lt', right })),
}))

const dbMocks = vi.hoisted(() => {
  const deleteWhere = vi.fn()
  const selectLimit = vi.fn<() => unknown[]>(() => [])
  const selectWhere = vi.fn(() => ({ limit: selectLimit }))
  const selectFrom = vi.fn(() => ({ where: selectWhere }))
  const updateReturning = vi.fn<() => unknown[]>(() => [])
  const updateWhere = vi.fn(() => ({ returning: updateReturning }))
  const updateSet = vi.fn(() => ({ where: updateWhere }))

  return {
    delete: vi.fn(() => ({ where: deleteWhere })),
    deleteWhere,
    select: vi.fn(() => ({ from: selectFrom })),
    selectFrom,
    selectLimit,
    selectWhere,
    update: vi.fn(() => ({ set: updateSet })),
    updateReturning,
    updateSet,
    updateWhere,
  }
})

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    and: orm.and,
    eq: orm.eq,
    isNotNull: orm.isNotNull,
    isNull: orm.isNull,
    lt: orm.lt,
  }
})

vi.mock('@/server/db/pool', () => ({
  db: {
    delete: dbMocks.delete,
    select: dbMocks.select,
    update: dbMocks.update,
  },
}))

const { consumeActiveLikeToken, existsActiveLikeToken, purgeOldLikeTokens } = await import('@/server/db/query/like')

beforeEach(() => {
  vi.clearAllMocks()
  dbMocks.selectLimit.mockReturnValue([])
})

describe('db/query/like.server', () => {
  it('purges only soft-deleted expired like tokens', async () => {
    const cutoff = new Date('2024-02-01T00:00:00.000Z')

    await purgeOldLikeTokens(cutoff)

    expect(dbMocks.delete).toHaveBeenCalledWith(like)
    expect(orm.isNotNull).toHaveBeenCalledWith(like.deletedAt)
    expect(orm.lt).toHaveBeenCalledWith(like.deletedAt, cutoff)
    expect(orm.and).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'isNotNull' }),
      expect.objectContaining({ op: 'lt' }),
    )
    expect(dbMocks.deleteWhere).toHaveBeenCalledWith(expect.objectContaining({ op: 'and' }))
  })

  it('checks like token existence against active rows only', async () => {
    dbMocks.selectLimit.mockReturnValueOnce([{ id: 1n }])

    await expect(existsActiveLikeToken('https://example.com/posts/a/', 'tok')).resolves.toBe(true)

    expect(dbMocks.select).toHaveBeenCalledWith({ id: like.id })
    expect(orm.eq).toHaveBeenCalledWith(like.token, 'tok')
    expect(orm.eq).toHaveBeenCalledWith(like.pageKey, 'https://example.com/posts/a/')
    expect(orm.isNull).toHaveBeenCalledWith(like.deletedAt)
    expect(orm.and).toHaveBeenCalledWith(
      expect.objectContaining({ op: 'eq', right: 'tok' }),
      expect.objectContaining({ op: 'eq', right: 'https://example.com/posts/a/' }),
      expect.objectContaining({ op: 'isNull' }),
    )
    expect(dbMocks.selectLimit).toHaveBeenCalledWith(1)
  })

  it('atomically consumes active like tokens with one conditional update', async () => {
    dbMocks.updateReturning.mockReturnValueOnce([{ id: 1n }])

    await expect(consumeActiveLikeToken('https://example.com/posts/a/', 'tok')).resolves.toBe(true)

    expect(dbMocks.update).toHaveBeenCalledWith(like)
    expect(dbMocks.updateSet).toHaveBeenCalledWith({
      updatedAt: expect.any(Date),
      deletedAt: expect.any(Date),
    })
    expect(orm.eq).toHaveBeenCalledWith(like.token, 'tok')
    expect(orm.eq).toHaveBeenCalledWith(like.pageKey, 'https://example.com/posts/a/')
    expect(orm.isNull).toHaveBeenCalledWith(like.deletedAt)
    expect(dbMocks.updateWhere).toHaveBeenCalledWith(expect.objectContaining({ op: 'and' }))
    expect(dbMocks.updateReturning).toHaveBeenCalledWith({ id: like.id })
  })
})
