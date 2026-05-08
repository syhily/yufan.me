import type { SQL } from 'drizzle-orm'

import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const dbMocks = vi.hoisted(() => ({
  execute: vi.fn<(query: SQL) => Promise<{ rows: unknown[] }>>(async () => ({ rows: [] })),
}))

vi.mock('@/server/db/pool', () => ({
  db: {
    execute: dbMocks.execute,
  },
}))

const { incrementPageViewsBatch } = await import('@/server/db/query/page')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('db/query/page.server', () => {
  it('casts batched view values to stable postgres types', async () => {
    await incrementPageViewsBatch(
      new Map([
        ['https://yufan.me/posts/a/', 1],
        ['https://yufan.me/posts/b/', 2],
      ]),
    )

    expect(dbMocks.execute).toHaveBeenCalledOnce()

    const [query] = dbMocks.execute.mock.calls[0]!
    const compiled = new PgDialect().sqlToQuery(query)

    expect(compiled.sql).toContain('($1::varchar(255), $2::bigint), ($3::varchar(255), $4::bigint)')
    expect(compiled.sql).toContain('COALESCE("page"."pv", 0) + v.delta')
    expect(compiled.params).toEqual(['https://yufan.me/posts/a/', 1, 'https://yufan.me/posts/b/', 2])
  })

  it('skips empty and non-positive batched view deltas', async () => {
    await incrementPageViewsBatch(
      new Map([
        ['https://yufan.me/posts/a/', 0],
        ['https://yufan.me/posts/b/', -1],
      ]),
    )

    expect(dbMocks.execute).not.toHaveBeenCalled()
  })
})
