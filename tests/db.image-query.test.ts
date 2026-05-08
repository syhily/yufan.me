import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { image } from '@/server/infra/db/schema'

// Drizzle's `insert(...).values(...).onConflictDoUpdate(...).returning()`
// chain is deeply nested. Mock out the chain at the chained-call level so
// the test can introspect the `target` / `set` payloads without spinning
// up Postgres.
const dbMocks = vi.hoisted(() => {
  const insertReturning = vi.fn<() => unknown[]>(() => [])
  const onConflictDoUpdate = vi.fn(() => ({ returning: insertReturning }))
  const onConflictDoNothing = vi.fn(() => ({ returning: insertReturning }))
  const insertValues = vi.fn(() => ({
    onConflictDoUpdate,
    onConflictDoNothing,
    returning: insertReturning,
  }))
  return {
    insert: vi.fn(() => ({ values: insertValues })),
    insertValues,
    insertReturning,
    onConflictDoUpdate,
    onConflictDoNothing,
  }
})

vi.mock('@/server/infra/db/pool', () => ({
  db: {
    insert: dbMocks.insert,
  },
}))

const { upsertImageByStoragePath, insertImageIfMissing } = await import('@/server/infra/db/query/image')

beforeEach(() => {
  vi.clearAllMocks()
  dbMocks.insertReturning.mockReturnValue([])
})

describe('db/query/image — upsertImageByStoragePath', () => {
  it('targets the storage_path unique index and clears deleted_at on conflict', async () => {
    dbMocks.insertReturning.mockReturnValue([
      {
        id: 1n,
        storagePath: 'images/2026/05/foo.jpg',
        width: 100,
        height: 100,
        byteSize: 12345,
        mimeType: 'image/jpeg',
        thumbhash: 'tt',
        uploaderId: 99n,
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ])

    await upsertImageByStoragePath({
      storagePath: 'images/2026/05/foo.jpg',
      mimeType: 'image/jpeg',
      width: 100,
      height: 100,
      byteSize: 12345,
      thumbhash: 'tt',
      uploaderId: 99n,
      note: null,
    })

    expect(dbMocks.insert).toHaveBeenCalledWith(image)
    // The values payload always carries `deletedAt: null` so a re-upload
    // after a soft-delete resurrects the row.
    const valuesCall = dbMocks.insertValues.mock.calls[0] as unknown as [Record<string, unknown>] | undefined
    expect(valuesCall).toBeDefined()
    const values = valuesCall![0]
    expect(values.deletedAt).toBeNull()
    expect(values.storagePath).toBe('images/2026/05/foo.jpg')

    // Conflict resolution targets the storage_path column and updates
    // every mutable field while clearing `deleted_at`.
    expect(dbMocks.onConflictDoUpdate).toHaveBeenCalledOnce()
    const conflictCall = dbMocks.onConflictDoUpdate.mock.calls[0] as unknown as
      | [{ target: unknown; set: Record<string, unknown> }]
      | undefined
    expect(conflictCall).toBeDefined()
    const conflictPayload = conflictCall![0]
    expect(conflictPayload.target).toBe(image.storagePath)
    expect(conflictPayload.set.thumbhash).toBe('tt')
    expect(conflictPayload.set.deletedAt).toBeNull()
    expect(conflictPayload.set.updatedAt).toBeInstanceOf(Date)
  })
})

describe('db/query/image — insertImageIfMissing', () => {
  it('returns null when ON CONFLICT DO NOTHING skips the insert', async () => {
    dbMocks.insertReturning.mockReturnValue([])
    const out = await insertImageIfMissing({
      storagePath: 'images/2026/05/duplicate.jpg',
      mimeType: 'image/jpeg',
      width: 1280,
      height: 425,
      byteSize: 0,
      thumbhash: null,
      uploaderId: null,
      note: null,
    })
    expect(out).toBeNull()
    expect(dbMocks.onConflictDoNothing).toHaveBeenCalledWith({ target: image.storagePath })
  })

  it('returns the new row on a successful insert', async () => {
    const row = {
      id: 7n,
      storagePath: 'images/legacy/foo.jpg',
      width: 800,
      height: 600,
      byteSize: 0,
      mimeType: 'image/jpeg',
      thumbhash: null,
      uploaderId: null,
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    }
    dbMocks.insertReturning.mockReturnValue([row])
    const out = await insertImageIfMissing(row)
    expect(out).toBe(row)
  })
})
