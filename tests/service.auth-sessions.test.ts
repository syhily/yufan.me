import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// In-memory stand-in for the subset of Redis the session-meta module
// uses. Only sadd/smembers/hgetall/hset/del are exercised here, which
// keeps the harness narrow enough to assert against without dragging
// in the full mock from `tests/_helpers/redis.ts`.
const userSets = new Map<string, Set<string>>()
const metaHashes = new Map<string, Record<string, string>>()

const redisStub = {
  sadd: vi.fn(async (key: string, value: string) => {
    const set = userSets.get(key) ?? new Set<string>()
    set.add(value)
    userSets.set(key, set)
    return 1
  }),
  smembers: vi.fn(async (key: string) => {
    return Array.from(userSets.get(key) ?? [])
  }),
  hset: vi.fn(async (key: string, fields: Record<string, string>) => {
    metaHashes.set(key, { ...metaHashes.get(key), ...fields })
    return Object.keys(fields).length
  }),
  hgetall: vi.fn(async (key: string) => {
    return metaHashes.get(key) ?? {}
  }),
  pexpireat: vi.fn(async () => 1),
  del: vi.fn(async (key: string) => {
    metaHashes.delete(key)
    userSets.delete(key)
    return 1
  }),
  srem: vi.fn(async () => 1),
  pipeline: () => {
    const ops: Array<() => Promise<unknown>> = []
    const builder = {
      del(key: string) {
        ops.push(async () => {
          metaHashes.delete(key)
          userSets.delete(key)
        })
        return builder
      },
      srem() {
        return builder
      },
      async exec() {
        for (const op of ops) {
          await op()
        }
        return []
      },
    }
    return builder
  },
}

vi.mock('@/server/cache/storage', () => ({
  redisInstance: () => redisStub,
}))

vi.mock('@/server/db/query/user', () => ({
  findUsersByIds: vi.fn(async () => []),
}))

const { listSessionsByUser, recordSessionLogin } = await import('@/server/auth/sessions')

beforeEach(() => {
  userSets.clear()
  metaHashes.clear()
  redisStub.sadd.mockClear()
  redisStub.smembers.mockClear()
  redisStub.hset.mockClear()
  redisStub.hgetall.mockClear()
})

describe('listSessionsByUser', () => {
  it('joins the user_sessions set with each session_meta hash and returns parsed metadata', async () => {
    const userId = 42n
    const loginAt = new Date('2026-05-01T08:00:00Z')

    // Seed two sessions for the same user. `recordSessionLogin` writes
    // the meta hash, and we manually mirror what `establishLoginSession`
    // would also do (SADD into `user_sessions:<id>`).
    await redisStub.sadd(`user_sessions:${userId}`, 'sid-a')
    await recordSessionLogin({
      sid: 'sid-a',
      userId,
      userAgent: 'Mozilla/5.0 (Macintosh) Chrome/120',
      ip: '203.0.113.1',
      loginAt,
    })
    await redisStub.sadd(`user_sessions:${userId}`, 'sid-b')
    await recordSessionLogin({
      sid: 'sid-b',
      userId,
      userAgent: null,
      ip: '203.0.113.2',
      loginAt,
    })

    // A session id that exists in the set but whose meta hash has
    // been evicted: must be filtered out, NOT yield an empty row.
    await redisStub.sadd(`user_sessions:${userId}`, 'sid-orphan')

    const sessions = await listSessionsByUser(userId)
    const ids = sessions.map((s) => s.sid).sort()
    expect(ids).toEqual(['sid-a', 'sid-b'])

    const first = sessions.find((s) => s.sid === 'sid-a')
    expect(first?.userId).toBe(userId)
    expect(first?.userAgent).toContain('Chrome')
    expect(first?.ip).toBe('203.0.113.1')
    expect(first?.loginAt.getTime()).toBe(loginAt.getTime())
    expect(first?.lastActiveAt.getTime()).toBe(loginAt.getTime())
    expect(first?.expiresAt.getTime()).toBeGreaterThan(loginAt.getTime())
  })

  it('returns empty when no sessions are registered', async () => {
    const sessions = await listSessionsByUser(7n)
    expect(sessions).toEqual([])
  })
})
