import type { AstroSession } from 'astro'

import { ActionError } from 'astro:actions'

import * as userRepo from '@/data/repositories/user'
import { queryUser } from '@/helpers/auth/user'

export async function login({
  email,
  password,
  session,
  request,
  clientAddress,
}: {
  email: string
  password: string
  session: AstroSession
  request: Request
  clientAddress: string
}): Promise<boolean> {
  const u = await queryUser(email, password)
  if (u === null) {
    return false
  }

  // Update the session.
  session.set('user', {
    id: u.id,
    name: u.name,
    email: u.email,
    website: u.link,
    admin: u.isAdmin !== null && u.isAdmin,
  })

  // Update the user information.
  await userRepo.updateLastLogin(u.id, clientAddress, request.headers.get('User-Agent'))

  return true
}

export async function userSession(session: AstroSession | undefined) {
  return await session?.get('user')
}

export function logout(session: AstroSession) {
  session.destroy()
}

export async function isAdmin(session: AstroSession | undefined) {
  if (session) {
    const u = await userSession(session)
    if (u) {
      return u.admin
    }
  }
  return false
}

/**
 * Require admin permission, throw ActionError if not admin
 * @param session - Astro session
 * @param errorMessage - Custom error message (optional)
 * @throws ActionError if user is not admin
 */
export async function requireAdmin(
  session: AstroSession | undefined,
  errorMessage = '当前用户不是管理员。',
): Promise<void> {
  const admin = await isAdmin(session)
  if (!admin) {
    throw new ActionError({
      code: 'UNAUTHORIZED',
      message: errorMessage,
    })
  }
}
