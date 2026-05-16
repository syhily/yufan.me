import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { music } from '@/server/infra/db/schema'

// Mock the Drizzle chain so the query helpers can be unit-tested
// without spinning up Postgres. Same pattern as
// `tests/db.image-query.test.ts`.
const dbMocks = vi.hoisted(() => {
  const insertReturning = vi.fn<() => unknown[]>(() => [])
  const insertValues = vi.fn(() => ({ returning: insertReturning }))

  const selectLimit = vi.fn<() => unknown[]>(() => [])
  const selectWhere = vi.fn(() => ({ limit: selectLimit }))
  const selectFrom = vi.fn(() => ({ where: selectWhere }))

  const updateReturning = vi.fn<() => unknown[]>(() => [])
  const updateWhere = vi.fn(() => ({ returning: updateReturning }))
  const updateSet = vi.fn(() => ({ where: updateWhere }))

  return {
    insert: vi.fn(() => ({ values: insertValues })),
    insertValues,
    insertReturning,
    select: vi.fn(() => ({ from: selectFrom })),
    selectFrom,
    selectWhere,
    selectLimit,
    update: vi.fn(() => ({ set: updateSet })),
    updateSet,
    updateWhere,
    updateReturning,
  }
})

vi.mock('@/server/infra/db/pool', () => ({
  db: {
    insert: dbMocks.insert,
    select: dbMocks.select,
    update: dbMocks.update,
  },
}))

const { insertMusic, findMusicByPlayerId, findMusicBySourceAndId, softDeleteMusic } =
  await import('@/server/infra/db/operations/music')

beforeEach(() => {
  vi.clearAllMocks()
  dbMocks.insertReturning.mockReturnValue([])
  dbMocks.selectLimit.mockReturnValue([])
  dbMocks.updateReturning.mockReturnValue([])
})

describe('db/query/music — insertMusic', () => {
  it('writes the row and stamps createdAt + updatedAt', async () => {
    const row = makeRow({ playerId: 'abcdef0123456789' })
    dbMocks.insertReturning.mockReturnValue([row])

    const result = await insertMusic({
      source: 'netease',
      sourceId: '12345',
      playerId: 'abcdef0123456789',
      name: 'Hello',
      artist: 'Adele',
      album: '25',
      audioStoragePath: 'musics/abcdef0123456789.mp3',
      coverStoragePath: 'musics/abcdef0123456789.jpg',
      lyric: '[00:00.000]Hello',
      uploaderId: null,
    })

    expect(dbMocks.insert).toHaveBeenCalledWith(music)
    const valuesCall = dbMocks.insertValues.mock.calls[0] as unknown as [Record<string, unknown>] | undefined
    expect(valuesCall).toBeDefined()
    const values = valuesCall![0]
    expect(values.source).toBe('netease')
    expect(values.playerId).toBe('abcdef0123456789')
    expect(values.createdAt).toBeInstanceOf(Date)
    expect(values.updatedAt).toBeInstanceOf(Date)
    expect(result).toBe(row)
  })
})

describe('db/query/music — findMusicByPlayerId', () => {
  it('returns the row when playerId matches and is not soft-deleted', async () => {
    const row = makeRow({ playerId: 'abcdef0123456789' })
    dbMocks.selectLimit.mockReturnValue([row])
    const found = await findMusicByPlayerId('abcdef0123456789')
    expect(found).toBe(row)
    expect(dbMocks.selectLimit).toHaveBeenCalledWith(1)
  })

  it('returns null when no row matches', async () => {
    dbMocks.selectLimit.mockReturnValue([])
    const found = await findMusicByPlayerId('zzzzzzzzzzzzzzzz')
    expect(found).toBeNull()
  })
})

describe('db/query/music — findMusicBySourceAndId', () => {
  it('queries by (source, sourceId) for the importer idempotency check', async () => {
    const row = makeRow({ source: 'netease', sourceId: '999' })
    dbMocks.selectLimit.mockReturnValue([row])
    const found = await findMusicBySourceAndId('netease', '999')
    expect(found).toBe(row)
  })
})

describe('db/query/music — softDeleteMusic', () => {
  it('writes deleted_at + updated_at and returns the soft-deleted row', async () => {
    const row = makeRow({ id: 42n })
    dbMocks.updateReturning.mockReturnValue([row])

    const out = await softDeleteMusic(42n)
    expect(out).toBe(row)
    expect(dbMocks.update).toHaveBeenCalledWith(music)
    const setCall = dbMocks.updateSet.mock.calls[0] as unknown as [Record<string, unknown>] | undefined
    expect(setCall).toBeDefined()
    const setValues = setCall![0]
    expect(setValues.deletedAt).toBeInstanceOf(Date)
    expect(setValues.updatedAt).toBeInstanceOf(Date)
  })

  it('returns null when no row matches the id', async () => {
    dbMocks.updateReturning.mockReturnValue([])
    const out = await softDeleteMusic(0n)
    expect(out).toBeNull()
  })
})

interface MusicRowOverrides {
  id?: bigint
  source?: string
  sourceId?: string
  playerId?: string
  name?: string
  artist?: string
  album?: string
  audioStoragePath?: string
  coverStoragePath?: string
  lyric?: string | null
  uploaderId?: bigint | null
}

function makeRow(overrides: MusicRowOverrides = {}): Record<string, unknown> {
  return {
    id: overrides.id ?? 1n,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    source: overrides.source ?? 'netease',
    sourceId: overrides.sourceId ?? '35847388',
    playerId: overrides.playerId ?? 'abcdef0123456789',
    name: overrides.name ?? 'Hello',
    artist: overrides.artist ?? 'Adele',
    album: overrides.album ?? '25',
    audioStoragePath: overrides.audioStoragePath ?? 'musics/abcdef0123456789.mp3',
    coverStoragePath: overrides.coverStoragePath ?? 'musics/abcdef0123456789.jpg',
    lyric: overrides.lyric ?? null,
    uploaderId: overrides.uploaderId ?? null,
  }
}
