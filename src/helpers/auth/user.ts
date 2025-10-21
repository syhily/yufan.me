import type { NewUser, User } from '@/helpers/db/types'
import bcrypt from 'bcryptjs'
import { count, eq, sql } from 'drizzle-orm'
import config from '@/blog.config'
import defer * as pool from '@/helpers/db/pool'
import { user } from '@/helpers/db/schema'

// Verify if there is an admin account in the website.
// The fresh installed instance won't have any admin accounts.
// The first registered account is admin account by default.
export async function hasAdmin(): Promise<boolean> {
  const res = await pool.db.select({ count: count() }).from(user).where(eq(user.isAdmin, true))
  return res.length > 0 && res[0].count > 0
}

export async function queryUser(email: string, password: string): Promise<null | User> {
  const res = await pool.db.select().from(user).where(eq(user.email, email)).limit(1)
  if (res.length === 1) {
    const user = res[0]
    if (await bcrypt.compare(password, user.password)) {
      return user
    }
  }
  return null
}

export async function queryUserId(email: string): Promise<string | null> {
  const results = await pool.db
    .select({
      id: user.id,
    })
    .from(user)
    .where(eq(user.email, sql`${email}`))
    .limit(1)

  if (results.length === 0) {
    return null
  }

  return `${results[0].id}`
}

export async function queryEmail(id: number): Promise<string | null> {
  const results = await pool.db
    .select({
      email: user.email,
    })
    .from(user)
    .where(eq(user.id, sql`${id}`))
    .limit(1)

  if (results.length === 0) {
    return null
  }

  return results[0].email
}

export async function createAdmin(name: string, email: string, password: string) {
  const hashedPassword = bcrypt.hashSync(password, 12)
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
  return await pool.db.insert(user).values(admin).returning()
}

export async function createUser(name: string, email: string, website: string): Promise<User | null> {
  const existing = await pool.db.select().from(user).where(eq(user.email, email)).limit(1)
  if (existing.length > 0) {
    return existing[0]
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
  const res = await pool.db.insert(user).values(u).returning()
  return res.length > 0 ? res[0] : null
}
