import type { User } from '@/server/db/types'

import { type Role } from '@/server/auth/rbac'
import {
  type BlogSession,
  commitSession,
  getRequestSession,
  revokeAllSessionsOfUser,
  type SessionUser,
} from '@/server/auth/session-storage'
import { recordSessionActivity, recordSessionLogin } from '@/server/auth/sessions'
import { redisInstance } from '@/server/cache/storage'
import { findUserById, updateLastLogin, verifyUserPassword } from '@/server/db/query/user'

export interface SessionContext {
  session: BlogSession
  user: SessionUser | undefined
  role: Role | null
}

export interface EstablishLoginOptions {
  /**
   * Revoke every OTHER session of this user before establishing the
   * new one. Required for credential-rotating flows (password reset,
   * accept-invite) where the very point of the operation is "kick
   * everyone else off". Default `false` — a fresh login should not
   * pre-emptively burn down concurrent sessions.
   */
  revokeOtherSessions?: boolean
}

/**
 * Write the session for a freshly-authenticated user and record the
 * session id under `user_sessions:<id>` so a future
 * `revokeAllSessionsOfUser` finds and clears it. Shared by password
 * login, install flow, password reset, and accept-invite — all four
 * code paths used to copy this block by hand and one of them (the
 * password-reset action) was silently leaving the user out of the
 * revocation set.
 *
 * Pass `{ revokeOtherSessions: true }` on credential-rotation paths
 * to kill stale cookies from the same account before issuing the
 * new one.
 */
export async function establishLoginSession(
  session: BlogSession,
  dbUser: User,
  request: Request,
  clientAddress: string,
  options: EstablishLoginOptions = {},
): Promise<void> {
  if (!dbUser.role) {
    throw new Error('establishLoginSession requires a user with a role')
  }
  if (options.revokeOtherSessions) {
    await revokeAllSessionsOfUser(dbUser.id)
  }
  session.set('user', {
    id: `${dbUser.id}`,
    name: dbUser.name,
    email: dbUser.email,
    website: dbUser.link,
    role: dbUser.role,
  })
  // Force the session id to materialise before any Redis bookkeeping
  // reads `session.id`. For a fresh login the cookie carries no sid,
  // so React Router's `createData` only runs during `commitSession` —
  // which the caller invokes AFTER us. Without this early commit our
  // `sadd('user_sessions:…', session.id)` would push an empty string
  // into the user-sessions index and the parallel `session_meta:` HSET
  // would key off the empty sid. The caller's subsequent
  // `commitSession` then becomes a cheap update on the now-materialised
  // id, so we don't lose the Set-Cookie path that mints the cookie
  // header.
  await commitSession(session)
  const userAgent = request.headers.get('User-Agent')
  await updateLastLogin(dbUser.id, clientAddress, userAgent)
  await redisInstance().sadd(`user_sessions:${dbUser.id}`, session.id)
  // Persist the per-session metadata that powers /my/sessions and
  // /wp-admin/sessions. Best-effort: any Redis hiccup here would
  // otherwise force a fresh login to fail, even though the cookie is
  // already valid. We log and continue.
  try {
    await recordSessionLogin({
      sid: session.id,
      userId: dbUser.id,
      userAgent,
      ip: clientAddress,
    })
  } catch {
    // The audit row is recoverable on next login; do not block the
    // user's auth flow.
  }
}

export async function login({
  email,
  password,
  session,
  request,
  clientAddress,
}: {
  email: string
  password: string
  session: BlogSession
  request: Request
  clientAddress: string
}): Promise<boolean> {
  const user = await verifyUserPassword(email, password)
  if (user === null || !user.role) {
    // Users without a role cannot log in (anonymous placeholder accounts).
    return false
  }
  await establishLoginSession(session, user, request, clientAddress)
  return true
}

export function userSession(session: BlogSession): SessionUser | undefined {
  return session.get('user')
}

export async function logout(session: BlogSession): Promise<void> {
  const user = userSession(session)
  if (user) {
    const sid = session.id
    const redis = redisInstance()
    await redis.srem(`user_sessions:${user.id}`, sid)
    // Drop the parallel meta hash so the admin / self-service views
    // stop listing a session whose cookie is no longer valid.
    await redis.del(`session_meta:${sid}`)
  }
  session.unset('user')
}

export async function resolveSessionContext(request: Request): Promise<SessionContext> {
  const session = await getRequestSession(request)
  let user = userSession(session)

  // Back-compat: upgrade legacy cookies that lack `role` by hitting the DB once.
  // The migration to drop `user.is_admin` runs in a follow-up release, so
  // cookies minted before this branch still carry `{ admin: boolean }`
  // and no `role`. We can't trust the cookie for the upgrade — the
  // authoritative answer lives in `user.role`.
  if (user && typeof (user as { role?: Role }).role !== 'string') {
    let dbUser: Awaited<ReturnType<typeof findUserById>> = null
    let dbReachable = true
    try {
      dbUser = await findUserById(BigInt(user.id))
    } catch {
      // Transient DB error — keep the existing session intact and try
      // again on the next request. Unsetting `user` here would log out
      // every active session every time the DB has a hiccup.
      dbReachable = false
    }
    if (dbUser && dbUser.role) {
      const upgraded: SessionUser = {
        id: `${dbUser.id}`,
        name: dbUser.name,
        email: dbUser.email,
        website: dbUser.link,
        role: dbUser.role,
      }
      session.set('user', upgraded)
      user = upgraded
    } else if (dbReachable) {
      // Account confirmed gone-or-demoted: drop the session so they
      // re-login. Only on a successful DB read — see comment above.
      session.unset('user')
      user = undefined
    }
  }

  // Fire-and-forget: bump `lastActiveAt` and PEXPIRE the meta hash
  // alongside the session cookie's sliding refresh, so the
  // session-management views show truthful "最近活跃" timestamps.
  // Must NOT block the request — the helper internally voids the
  // promise and catches errors.
  if (user) {
    recordSessionActivity(session.id)
    // Self-healing migration: sessions minted before
    // `establishLoginSession` forced an early `commitSession` had
    // empty-string sids in the `user_sessions` set + empty-keyed
    // `session_meta:` hash. On every authenticated request, ensure
    // the REAL sid is registered. Idempotent `sadd` is a no-op when
    // the member already exists; backfilling the meta hash is left to
    // a subsequent login, since we can't reconstruct `loginAt` from
    // here.
    void redisInstance()
      .sadd(`user_sessions:${user.id}`, session.id)
      .catch(() => {})
  }

  return { session, user, role: user?.role ?? null }
}
