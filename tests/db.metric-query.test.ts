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

const { incrementMetricPvBatch } = await import('@/server/db/query/metric')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('db/query/metric', () => {
  it('casts batched view values to stable postgres types', async () => {
    await incrementMetricPvBatch(
      new Map([
        ['post:1', 1],
        ['page:2', 2],
      ]),
    )

    expect(dbMocks.execute).toHaveBeenCalledOnce()

    const [query] = dbMocks.execute.mock.calls[0]!
    const compiled = new PgDialect().sqlToQuery(query)

    expect(compiled.sql).toContain(
      '($1::varchar(16), $2::bigint, $3::bigint), ($4::varchar(16), $5::bigint, $6::bigint)',
    )
    expect(compiled.sql).toContain('COALESCE("metric"."pv", 0) + v.delta')
    expect(compiled.params).toEqual(['post', '1', 1, 'page', '2', 2])
  })

  it('skips empty and non-positive batched view deltas', async () => {
    await incrementMetricPvBatch(
      new Map([
        ['post:1', 0],
        ['page:2', -1],
      ]),
    )

    expect(dbMocks.execute).not.toHaveBeenCalled()
  })

  it('skips malformed composite keys (no colon, unknown type, empty id)', async () => {
    await incrementMetricPvBatch(
      new Map([
        ['notarget', 5],
        ['note:42', 5],
        ['post:', 5],
      ]),
    )
    expect(dbMocks.execute).not.toHaveBeenCalled()
  })
})
