import type { Session } from 'react-router'

import { createSessionStorage } from 'react-router'

import type { Role } from '@/server/auth/rbac'

import { redisInstance } from '@/server/cache/storage'
import { SESSION_SECRET } from '@/server/env'

export interface SessionUser {
  id: string
  name: string
  email: string
  website: string | null
  role: Role | null
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
  // Mirror the session id into the per-user Set so `revokeAllSessionsOfUser`
  // can enumerate and destroy every session for a single user atomically.
  if (data.user?.id) {
    await redis.sadd(`user_sessions:${data.user.id}`, id)
  }
}

export const { getSession, commitSession, destroySession } = storage

export async function getRequestSession(request: Request): Promise<BlogSession> {
  return getSession(request.headers.get('Cookie'))
}

export async function revokeAllSessionsOfUser(userId: string | bigint): Promise<void> {
  const redis = redisInstance()
  const key = `user_sessions:${String(userId)}`
  const members = await redis.smembers(key)
  if (members.length === 0) {
    return
  }
  const pipeline = redis.pipeline()
  pipeline.del(key)
  for (const sid of members) {
    pipeline.del(`session:${sid}`)
  }
  await pipeline.exec()
}
