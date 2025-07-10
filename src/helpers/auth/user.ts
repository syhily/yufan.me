import type { NewUser, User } from '@/helpers/db/types'
import bcrypt from 'bcryptjs'
import { count, eq, sql } from 'drizzle-orm'
import { db } from '@/helpers/db/pool'
import { user } from '@/helpers/db/schema'
import options from '@/options'

// Verify if there is an admin account in the website.
// The fresh installed instance won't have any admin accounts.
// The first registered account is admin account by default.
export async function hasAdmin(): Promise<boolean> {
  const res = await db.select({ count: count() }).from(user).where(eq(user.isAdmin, true))
  return res.length > 0 && res[0].count > 0
}

export async function queryUserId(email: string): Promise<string | null> {
  const results = await db
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
  const results = await db
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
  const hashedPassword = bcrypt.hashSync(password, 10)
  const admin: NewUser = {
    name,
    email,
    emailVerified: false,
    link: options.website,
    isAdmin: true,
    password: hashedPassword,
    badgeName: 'MOD',
    badgeColor: '#008c95',
    receiveEmail: true,
  }
  return await db.insert(user).values(admin).returning()
}

export async function verifyCredential(email: string, password: string): Promise<string | User> {
  const res = await db.select().from(user).where(eq(user.email, email)).limit(1)
  if (res.length === 1) {
    const user = res[0]
    if (await bcrypt.compare(password, user.password)) {
      return user
    }
  }
  return 'Invalid credential'
}
