import type { InferSelectModel } from 'drizzle-orm'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/helpers/db/pool'
import { user } from '@/helpers/db/schema'

// TODO Delete this method
export async function queryUser(email: string): Promise<InferSelectModel<typeof user> | null> {
  const results = await db
    .select()
    .from(user)
    .where(eq(user.email, sql`${email}`))
  if (results.length === 0) {
    return null
  }

  return results[0]
}
