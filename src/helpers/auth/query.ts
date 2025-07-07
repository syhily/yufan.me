import { count, eq } from 'drizzle-orm'
import { db } from '@/helpers/db/pool'
import { user } from '@/helpers/db/schema'

// Verify if there is an admin account in the website.
// The fresh installed instance won't have any admin accounts.
// The first registered account is admin account by default.
export async function hasAdmin(): Promise<boolean> {
  const res = await db.select({ count: count() }).from(user).where(eq(user.isAdmin, true))
  return res.length > 0 && res[0].count > 0
}
