import type { Session } from 'react-router'

import { createSessionStorage } from 'react-router'

import { redisInstance } from '@/server/cache/storage'
import { SESSION_SECRET } from '@/server/env'

export type Role = 'admin' | 'author' | 'visitor'

export interface SessionUser {
  id: string
  name: string
  email: string
  website: string | null
  role: Role
}

export interface BlogSessionData {
  user?: SessionUser
}

export type BlogSession = Session<BlogSessionData, BlogSessionData>

const SESSION_MAX_AGE = 60 * 60 * 24 * 30

const storage = createSessionStorage<BlogSessionData>({
  cookie: {
    name: '__session',
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    secrets: [SESSION_SECRET],
  },
  async createData(data, expires) {
    const id = crypto.randomUUID()
    await writeSession(id, data, expires)
    return id
  },
  async readData(id) {
    const value = await redisInstance().get(`session:${id}`)
    if (!value) {
      return null
    }
    return JSON.parse(value) as BlogSessionData
  },
  async updateData(id, data, expires) {
    await writeSession(id, data, expires)
  },
  async deleteData(id) {
    await redisInstance().del(`session:${id}`)
  },
})

async function writeSession(id: string, data: BlogSessionData, expires: Date | undefined): Promise<void> {
  const redis = redisInstance()
  const payload = JSON.stringify(data)
  if (expires) {
    await redis.set(`session:${id}`, payload, 'PXAT', expires.getTime())
  } else {
    await redis.set(`session:${id}`, payload, 'EX', SESSION_MAX_AGE)
  }
}

export const { getSession, commitSession, destroySession } = storage

export async function getRequestSession(request: Request): Promise<BlogSession> {
  return getSession(request.headers.get('Cookie'))
}

/**
 * Revoke every session belonging to a user. Called after password change
 * or role downgrade so stale cookies cannot be reused.
 *
 * `exceptSessionId` keeps one session alive — used by self-service
 * password change so the user is not logged out from the tab that just
 * saved the new password.
 */
export async function revokeAllSessionsOfUser(userId: bigint, exceptSessionId?: string): Promise<void> {
  const redis = redisInstance()
  const setKey = `user_sessions:${userId}`
  const sessionIds = await redis.smembers(setKey)
  const targets = exceptSessionId ? sessionIds.filter((sid) => sid !== exceptSessionId) : sessionIds
  if (targets.length === 0) {
    return
  }
  const pipeline = redis.pipeline()
  for (const sid of targets) {
    pipeline.del(`session:${sid}`)
    pipeline.srem(setKey, sid)
  }
  await pipeline.exec()
}
