import type { BlogSession, SessionUser } from '@/server/auth/session-storage'

import { getRequestSession } from '@/server/auth/session-storage'
import { updateLastLogin, verifyUserPassword } from '@/server/db/query/user'

export interface SessionContext {
  session: BlogSession
  user: SessionUser | undefined
  admin: boolean
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
    admin: user.isAdmin !== null && user.isAdmin,
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

export function isAdmin(session: BlogSession): boolean {
  return userSession(session)?.admin === true
}

export async function resolveSessionContext(request: Request): Promise<SessionContext> {
  const session = await getRequestSession(request)
  const user = userSession(session)
  return { session, user, admin: user?.admin === true }
}
