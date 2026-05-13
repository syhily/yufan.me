// Session metadata facade. The cookie-backed session storage lives in
// `session-storage.ts` (signed `__session` cookie + `session:<sid>`
// blob in Redis); this module owns the PARALLEL `session_meta:<sid>`
// hash that powers `/my/sessions` and `/wp-admin/sessions`.
//
// Wire shape (HSET fields, all stored as strings):
//   userId        bigint as decimal string
//   userAgent     User-Agent header, truncated to USER_AGENT_MAX_LENGTH
//   ip            client IP (from `getClientAddress`)
//   loginAt       ms-since-epoch integer string (set at login)
//   lastActiveAt  ms-since-epoch integer string (bumped each request)
//   expiresAt     ms-since-epoch integer string (login + SESSION_MAX_AGE)
//
// TTL: meta hash and session blob share the same PEXPIREAT so the meta
// hash can never outlive the session it describes.
//
// All meta writes from the hot request path MUST be fire-and-forget —
// see `recordSessionActivity` for the canonical pattern.

import type { Role } from '@/shared/roles'

import { SESSION_MAX_AGE } from '@/server/auth/session-storage'
import { redisInstance } from '@/server/cache/storage'
import { findUsersByIds } from '@/server/db/query/user'
import { getLogger } from '@/server/logger'

const log = getLogger('auth.sessions')

const USER_AGENT_MAX_LENGTH = 512

const META_KEY = (sid: string) => `session_meta:${sid}`
const USER_SET_KEY = (userId: bigint | string) => `user_sessions:${userId}`

export interface SessionMeta {
  sid: string
  userId: bigint
  userAgent: string
  ip: string
  loginAt: Date
  lastActiveAt: Date
  expiresAt: Date
}

export interface SessionWithUser extends SessionMeta {
  userName: string
  userEmail: string
  userRole: Role | null
}

interface RecordLoginInput {
  sid: string
  userId: bigint
  userAgent: string | null
  ip: string
  /** Defaults to now. Overridable for tests. */
  loginAt?: Date
}

function truncateUserAgent(ua: string | null): string {
  if (!ua) {
    return ''
  }
  return ua.length > USER_AGENT_MAX_LENGTH ? ua.slice(0, USER_AGENT_MAX_LENGTH) : ua
}

/**
 * Persist the metadata for a freshly-established session. Called from
 * `establishLoginSession` AFTER the `user_sessions:<userId>` set has
 * been updated, so the meta hash can be looked up by SID without a
 * fallback scan.
 */
export async function recordSessionLogin(input: RecordLoginInput): Promise<void> {
  const redis = redisInstance()
  const now = input.loginAt ?? new Date()
  const loginMs = now.getTime()
  const expiresMs = loginMs + SESSION_MAX_AGE * 1000
  const fields = {
    userId: input.userId.toString(),
    userAgent: truncateUserAgent(input.userAgent),
    ip: input.ip,
    loginAt: String(loginMs),
    lastActiveAt: String(loginMs),
    expiresAt: String(expiresMs),
  }
  await redis.hset(META_KEY(input.sid), fields)
  // Pin the meta key to the same expiry as the session blob.
  await redis.pexpireat(META_KEY(input.sid), expiresMs)
}

/**
 * Fire-and-forget bump of `lastActiveAt` and the meta key's TTL. Called
 * from `resolveSessionContext` on every authenticated request — must
 * stay off the synchronous request path.
 *
 * The PEXPIRE keeps the meta hash aligned with the session cookie's
 * sliding-refresh: as long as the user is active, both the session
 * blob and the meta hash get pushed forward by `SESSION_MAX_AGE`.
 */
export function recordSessionActivity(sid: string): void {
  const redis = redisInstance()
  const now = Date.now()
  const newExpiresAt = now + SESSION_MAX_AGE * 1000
  void Promise.all([
    redis.hset(META_KEY(sid), {
      lastActiveAt: String(now),
      expiresAt: String(newExpiresAt),
    }),
    redis.pexpireat(META_KEY(sid), newExpiresAt),
  ]).catch((error) => {
    log.warn('failed to refresh session meta', { sid, error: String(error) })
  })
}

function parseMeta(sid: string, hash: Record<string, string>): SessionMeta | null {
  if (!hash || Object.keys(hash).length === 0) {
    return null
  }
  const userIdRaw = hash.userId
  if (!userIdRaw) {
    return null
  }
  let userId: bigint
  try {
    userId = BigInt(userIdRaw)
  } catch {
    return null
  }
  const loginAt = Number(hash.loginAt ?? '0')
  const lastActiveAt = Number(hash.lastActiveAt ?? '0')
  const expiresAt = Number(hash.expiresAt ?? '0')
  return {
    sid,
    userId,
    userAgent: hash.userAgent ?? '',
    ip: hash.ip ?? '',
    loginAt: new Date(loginAt),
    lastActiveAt: new Date(lastActiveAt),
    expiresAt: new Date(expiresAt),
  }
}

/**
 * Enumerate every active session for one user. Reads
 * `user_sessions:<id>` and joins each entry to its meta hash. Stale
 * ids (set entry exists but the meta hash has been evicted by Redis
 * eviction or a manual cleanup) are filtered out — they would render
 * as empty rows in the UI.
 */
export async function listSessionsByUser(userId: bigint): Promise<SessionMeta[]> {
  const redis = redisInstance()
  const sids = await redis.smembers(USER_SET_KEY(userId))
  if (sids.length === 0) {
    return []
  }
  // Filter empty-string sids defensively — legacy logins (before
  // `establishLoginSession` forced an early `commitSession`) wrote
  // `''` into the user-sessions set and a `session_meta:` (empty
  // key) hash. Excluding them here keeps the orphan row out of the
  // UI and prevents a revoke click from hitting the bogus key.
  const realSids = sids.filter((sid) => sid !== '')
  if (realSids.length === 0) {
    return []
  }
  const metas = await Promise.all(
    realSids.map(async (sid) => {
      const hash = (await redis.hgetall(META_KEY(sid))) as Record<string, string>
      return parseMeta(sid, hash)
    }),
  )
  return metas.filter((meta): meta is SessionMeta => meta !== null && meta.userId === userId)
}

/**
 * Enumerate every active session across the site. Uses `SCAN` over
 * `session_meta:*` so we never block the Redis main thread, and joins
 * results against the `user` table in a single bulk read.
 *
 * Performance note: this is an O(N_sessions) scan + one DB round trip.
 * For a small-to-medium blog (N <= a few thousand) that is acceptable.
 * A larger deployment should add pagination or a sorted-set index;
 * keep the contract simple until that becomes a real problem.
 */
export async function listAllSessions(): Promise<SessionWithUser[]> {
  const redis = redisInstance()
  const sids: string[] = []
  let cursor = '0'
  do {
    const [next, keys] = (await redis.scan(cursor, 'MATCH', 'session_meta:*', 'COUNT', 500)) as [string, string[]]
    cursor = next
    for (const key of keys) {
      sids.push(key.slice('session_meta:'.length))
    }
  } while (cursor !== '0')
  if (sids.length === 0) {
    return []
  }
  const metas = await Promise.all(
    sids.map(async (sid) => {
      const hash = (await redis.hgetall(META_KEY(sid))) as Record<string, string>
      return parseMeta(sid, hash)
    }),
  )
  const validMetas = metas.filter((meta): meta is SessionMeta => meta !== null)
  if (validMetas.length === 0) {
    return []
  }
  const uniqueIds = Array.from(new Set(validMetas.map((m) => m.userId)))
  const users = await findUsersByIds(uniqueIds)
  const userById = new Map(users.map((u) => [u.id.toString(), u]))
  return validMetas.map((meta) => {
    const u = userById.get(meta.userId.toString())
    return {
      ...meta,
      userName: u?.name ?? '已删除的用户',
      userEmail: u?.email ?? '',
      userRole: u?.role ?? null,
    }
  })
}

/**
 * Revoke one session by its id. The cookie-side `session:<sid>` blob,
 * the `user_sessions:<userId>` index entry, and the `session_meta:<sid>`
 * hash are all dropped atomically (via a single pipeline) so a partial
 * delete cannot leave the admin view showing a session whose cookie
 * has already been invalidated.
 *
 * Role-blind: callers must enforce ownership / admin-bypass. See
 * `account.revokeSession` (visitor-owned) and `admin.revokeSession`
 * (admin-only) for the two perimeter checks.
 */
export async function revokeSessionById(sid: string, userId: bigint): Promise<void> {
  const redis = redisInstance()
  const pipeline = redis.pipeline()
  pipeline.del(`session:${sid}`)
  pipeline.del(META_KEY(sid))
  pipeline.srem(USER_SET_KEY(userId), sid)
  await pipeline.exec()
}

/**
 * Fetch one meta row by id. Returns `null` if Redis no longer has the
 * hash (the session expired or was already revoked). Used by the API
 * actions to confirm ownership before deleting.
 */
export async function findSessionMeta(sid: string): Promise<SessionMeta | null> {
  const redis = redisInstance()
  const hash = (await redis.hgetall(META_KEY(sid))) as Record<string, string>
  return parseMeta(sid, hash)
}
