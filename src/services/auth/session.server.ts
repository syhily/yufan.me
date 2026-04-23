import type { Session } from 'react-router'

import Redis from 'ioredis'
import { createSessionStorage } from 'react-router'

import type { BlogSessionData } from '@/services/auth/types'

import { updateLastLogin, verifyUserPassword } from '@/db/query/user.server'
import { DomainError } from '@/schemas/errors'
import { REDIS_URL, SESSION_SECRET } from '@/shared/env.server'

const SESSION_MAX_AGE = 60 * 60 * 24 * 30
let redis: Redis | null = null

function getRedis(): Redis {
  if (!REDIS_URL) {
    throw new Error('Missing required environment variable: REDIS_URL')
  }
  redis ??= new Redis(REDIS_URL)
  return redis
}

export type BlogSession = Session<BlogSessionData, BlogSessionData>

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
    const payload = JSON.stringify(data)
    const redis = getRedis()
    if (expires) {
      await redis.set(`session:${id}`, payload, 'PXAT', expires.getTime())
    } else {
      await redis.set(`session:${id}`, payload, 'EX', SESSION_MAX_AGE)
    }
    return id
  },
  async readData(id) {
    const redis = getRedis()
    const value = await redis.get(`session:${id}`)
    if (!value) return null
    return JSON.parse(value) as BlogSessionData
  },
  async updateData(id, data, expires) {
    const payload = JSON.stringify(data)
    const redis = getRedis()
    if (expires) {
      await redis.set(`session:${id}`, payload, 'PXAT', expires.getTime())
    } else {
      await redis.set(`session:${id}`, payload, 'EX', SESSION_MAX_AGE)
    }
  },
  async deleteData(id) {
    const redis = getRedis()
    await redis.del(`session:${id}`)
  },
})

export const { getSession, commitSession, destroySession } = storage

export async function getRequestSession(request: Request) {
  return getSession(request.headers.get('Cookie'))
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

export function userSession(session: BlogSession | null | undefined) {
  return session?.get('user')
}

export function logout(session: BlogSession) {
  session.unset('user')
  session.unset('csrf')
}

export function isAdmin(session: BlogSession | null | undefined) {
  return userSession(session)?.admin === true
}

export function requireAdmin(session: BlogSession | null | undefined, errorMessage = '当前用户不是管理员。'): void {
  if (!isAdmin(session)) {
    throw new DomainError('UNAUTHORIZED', errorMessage)
  }
}
