import bcrypt from 'bcryptjs'
import { count, eq } from 'drizzle-orm'

import type { NewUser, User } from '@/server/db/types'

import config from '@/blog.config'
import { db } from '@/server/db/pool'
import { user } from '@/server/db/schema'

const PASSWORD_HASH_ROUNDS = 12

export async function hasAdmin(): Promise<boolean> {
  const res = await db.select({ count: count() }).from(user).where(eq(user.isAdmin, true))
  return res.length > 0 && res[0].count > 0
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await db.select().from(user).where(eq(user.email, email)).limit(1)
  return rows[0] ?? null
}

export async function verifyUserPassword(email: string, password: string): Promise<User | null> {
  const u = await findUserByEmail(email)
  if (u === null) {
    return null
  }
  return (await bcrypt.compare(password, u.password)) ? u : null
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  return rows[0] ? `${rows[0].id}` : null
}

export async function findEmailById(id: bigint): Promise<string | null> {
  const rows = await db.select({ email: user.email }).from(user).where(eq(user.id, id)).limit(1)
  return rows[0]?.email ?? null
}

export async function insertAdmin(name: string, email: string, password: string): Promise<User[]> {
  const hashedPassword = bcrypt.hashSync(password, PASSWORD_HASH_ROUNDS)
  const admin: NewUser = {
    name,
    email,
    emailVerified: false,
    link: config.website || '',
    isAdmin: true,
    password: hashedPassword,
    badgeName: 'MOD',
    badgeColor: '#008c95',
    receiveEmail: true,
  }
  return db.insert(user).values(admin).returning()
}

export async function insertCommentUser(name: string, email: string, website: string): Promise<User | null> {
  const existing = await findUserByEmail(email)
  if (existing !== null) {
    return existing
  }
  const u: NewUser = {
    name,
    email,
    emailVerified: false,
    link: website,
    isAdmin: false,
    password: '',
    badgeName: '',
    badgeColor: '',
    receiveEmail: true,
  }
  const res = await db.insert(user).values(u).returning()
  return res[0] ?? null
}

export async function updateLastLogin(id: bigint, ip: string, userAgent: string | null): Promise<void> {
  await db.update(user).set({ lastIp: ip, lastUa: userAgent }).where(eq(user.id, id))
}

export interface UserUpdate {
  name?: string
  email?: string
  link?: string
  badgeName?: string
  badgeColor?: string
}

export async function updateUserById(id: bigint, patch: UserUpdate): Promise<User | null> {
  const updated = await db.update(user).set(patch).where(eq(user.id, id)).returning()
  return updated[0] ?? null
}
