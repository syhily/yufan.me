import type { AstroSession } from 'astro'
import { eq } from 'drizzle-orm'
import { queryUser } from '@/helpers/auth/user'
import defer * as pool from '@/helpers/db/pool'
import { user } from '@/helpers/db/schema'

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
  await pool.db
    .update(user)
    .set({
      lastIp: clientAddress,
      lastUa: request.headers.get('User-Agent'),
    })
    .where(eq(user.id, u.id))

  return true
}

export async function userSession(session: AstroSession) {
  return await session.get('user')
}

export function logout(session: AstroSession) {
  session.destroy()
}
