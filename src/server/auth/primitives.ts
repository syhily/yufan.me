import type { BlogSession, SessionUser } from '@/server/auth/session-storage'

import { getRequestSession } from '@/server/auth/session-storage'
import { updateLastLogin, verifyUserPassword } from '@/server/db/query/user'

export interface SessionContext {
  session: BlogSession
  user: SessionUser | undefined
  role: SessionUser['role']
  /** @deprecated Use `role === 'admin'` instead. */
  admin: boolean
}

// Detect a pre-RBAC session that carries the legacy `admin` boolean and patch
// it in-place by round-tripping through the DB.  Called exactly once per legacy
// cookie, right after the first re-hydration, so the cost is amortised to zero
// for the rest of the session lifetime.
async function migrateLegacySession(
  session: BlogSession,
  user: SessionUser & { admin?: boolean; role?: SessionUser['role'] },
): Promise<SessionUser | undefined> {
  if (user.role !== undefined) {
    // Already an RBAC session.
    if ('admin' in user) {
      delete (user as unknown as Record<string, unknown>).admin
    }
    return user as unknown as SessionUser
  }
  // Legacy cookie present.  Re-fetch the user row to learn the true role.
  const id = BigInt(user.id)
  const { findUserById } = await import('@/server/db/query/user')
  const dbUser = await findUserById(id)
  if (dbUser === null) {
    session.unset('user')
    return undefined
  }
  const migrated: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    website: user.website,
    role: dbUser.role as SessionUser['role'],
  }
  session.set('user', migrated)
  return migrated
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
  if (user === null) {
    return false
  }

  session.set('user', {
    id: `${user.id}`,
    name: user.name,
    email: user.email,
    website: user.link,
    role: user.role as SessionUser['role'],
  })

  await updateLastLogin(user.id, clientAddress, request.headers.get('User-Agent'))
  return true
}

export function userSession(session: BlogSession): SessionUser | undefined {
  return session.get('user')
}

export function logout(session: BlogSession): void {
  session.unset('user')
}

/** @deprecated Use `hasAtLeast(ctx.role, 'admin')` from `@/server/auth/rbac` instead. */
export function isAdmin(session: BlogSession): boolean {
  return userSession(session)?.role === 'admin'
}

export async function resolveSessionContext(request: Request): Promise<SessionContext> {
  const session = await getRequestSession(request)
  const raw = session.get('user')
  const user =
    raw !== undefined
      ? await migrateLegacySession(session, raw as Parameters<typeof migrateLegacySession>[1])
      : undefined
  const role = user?.role ?? null
  return { session, user, role, admin: role === 'admin' }
}
