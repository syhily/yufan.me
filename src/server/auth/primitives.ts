import type { BlogSession, SessionUser } from '@/server/auth/session-storage'

import { hasAtLeast, type Role } from '@/server/auth/rbac'
import { getRequestSession } from '@/server/auth/session-storage'
import { redisInstance } from '@/server/cache/storage'
import { findUserById, updateLastLogin, verifyUserPassword } from '@/server/db/query/user'

export interface SessionContext {
  session: BlogSession
  user: SessionUser | undefined
  role: Role | null
  /** @deprecated use `role` via {@link hasAtLeast} */
  admin: boolean
}

function deriveRole(user: SessionUser | undefined): Role | null {
  if (!user) return null
  // Back-compat: legacy cookies stored `admin: boolean` without `role`.
  if ('role' in user && user.role) return user.role
  if (user.admin === true) return 'admin'
  return null
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

  const role = user.role ?? (user.isAdmin ? 'admin' : null)
  if (!role) {
    // Users without a role cannot log in (anonymous placeholder accounts).
    return false
  }

  session.set('user', {
    id: `${user.id}`,
    name: user.name,
    email: user.email,
    website: user.link,
    role,
    admin: role === 'admin',
  })

  await updateLastLogin(user.id, clientAddress, request.headers.get('User-Agent'))
  await redisInstance().sadd(`user_sessions:${user.id}`, session.id)
  return true
}

export function userSession(session: BlogSession): SessionUser | undefined {
  return session.get('user')
}

export async function logout(session: BlogSession): Promise<void> {
  const user = userSession(session)
  if (user) {
    const sid = session.id
    await redisInstance().srem(`user_sessions:${user.id}`, sid)
  }
  session.unset('user')
}

export function isAdmin(session: BlogSession): boolean {
  const user = userSession(session)
  if (!user) return false
  return hasAtLeast(deriveRole(user), 'admin')
}

export async function resolveSessionContext(request: Request): Promise<SessionContext> {
  const session = await getRequestSession(request)
  let user = userSession(session)

  // Back-compat: upgrade legacy cookies that lack `role` by hitting the DB once.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybeLegacy = user as any
  if (user && maybeLegacy.role === undefined) {
    const dbUser = await findUserById(BigInt(user.id))
    if (dbUser && dbUser.role) {
      const upgraded: SessionUser = {
        id: `${dbUser.id}`,
        name: dbUser.name,
        email: dbUser.email,
        website: dbUser.link,
        role: dbUser.role,
        admin: dbUser.role === 'admin',
      }
      session.set('user', upgraded)
      user = upgraded
    }
  }

  const role = deriveRole(user)
  return { session, user, role, admin: hasAtLeast(role, 'admin') }
}
