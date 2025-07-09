import type { InferSelectModel } from 'drizzle-orm'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/helpers/db/pool'
import { like, page, user } from '@/helpers/db/schema'
import { makeToken, urlJoin } from '@/helpers/tools'
import options from '@/options'

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

const generatePageKey = (permalink: string): string => urlJoin(options.website, permalink, '/')

export async function increaseLikes(permalink: string): Promise<{ like: number, token: string }> {
  const pageKey = generatePageKey(permalink)
  const token = makeToken(250)
  // Save the token
  await db.insert(like).values({
    token,
    pageKey,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  // Bump the like
  await db
    .update(page)
    .set({
      voteUp: sql`${page.voteUp} + 1`,
    })
    .where(eq(page.key, sql`${pageKey}`))

  return { like: await queryLikes(permalink), token }
}

export async function decreaseLikes(permalink: string, token: string) {
  const pageKey = generatePageKey(permalink)
  const results = await db
    .select({ id: like.id })
    .from(like)
    .where(and(eq(like.token, token), eq(like.pageKey, pageKey), isNull(like.deletedAt)))
    .limit(1)

  // No need to dislike
  if (results.length <= 0) {
    return
  }

  const id = results[0].id
  // Remove the token
  await db
    .update(like)
    .set({
      updatedAt: new Date(),
      deletedAt: new Date(),
    })
    .where(eq(like.id, id))
  // Decrease the like
  await db
    .update(page)
    .set({
      voteUp: sql`${page.voteUp} - 1`,
    })
    .where(eq(page.key, sql`${pageKey}`))
}

export async function queryLikes(permalink: string): Promise<number> {
  const pageKey = generatePageKey(permalink)
  const results = await db
    .select({ like: page.voteUp })
    .from(page)
    .where(eq(page.key, sql`${pageKey}`))
    .limit(1)

  return results.length > 0 ? (results[0].like ?? 0) : 0
}

export async function queryLikesAndViews(permalink: string): Promise<[number, number]> {
  const pageKey = generatePageKey(permalink)
  const results = await db
    .select({ like: page.voteUp, view: page.pv })
    .from(page)
    .where(eq(page.key, sql`${pageKey}`))
    .limit(1)

  return results.length > 0 ? [results[0].like ?? 0, results[0].view ?? 0] : [0, 0]
}
