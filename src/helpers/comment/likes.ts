import { joinPaths } from '@astrojs/internal-helpers/path'
import { and, eq, isNull, sql } from 'drizzle-orm'
import config from '@/blog.config'
import defer * as pool from '@/helpers/db/pool'
import { like, page } from '@/helpers/db/schema'
import { makeToken } from '@/helpers/tools'

const generatePageKey = (permalink: string): string => joinPaths(config.website, permalink, '/')

export async function increaseLikes(permalink: string): Promise<{ likes: number, token: string }> {
  const pageKey = generatePageKey(permalink)
  const token = makeToken(250)
  // Save the token
  await pool.db.insert(like).values({
    token,
    pageKey,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  // Bump the like
  await pool.db
    .update(page)
    .set({
      voteUp: sql`${page.voteUp} + 1`,
    })
    .where(eq(page.key, sql`${pageKey}`))

  return { likes: await queryLikes(permalink), token }
}

export async function decreaseLikes(permalink: string, token: string) {
  const pageKey = generatePageKey(permalink)
  const results = await pool.db
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
  await pool.db
    .update(like)
    .set({
      updatedAt: new Date(),
      deletedAt: new Date(),
    })
    .where(eq(like.id, id))
  // Decrease the like
  await pool.db
    .update(page)
    .set({
      voteUp: sql`${page.voteUp} - 1`,
    })
    .where(eq(page.key, sql`${pageKey}`))
}

export async function queryLikes(permalink: string): Promise<number> {
  const pageKey = generatePageKey(permalink)
  const results = await pool.db
    .select({ like: page.voteUp })
    .from(page)
    .where(eq(page.key, sql`${pageKey}`))
    .limit(1)

  return results.length > 0 ? (results[0].like ?? 0) : 0
}

export async function queryLikesAndViews(permalink: string): Promise<[number, number]> {
  const pageKey = generatePageKey(permalink)
  const results = await pool.db
    .select({ like: page.voteUp, view: page.pv })
    .from(page)
    .where(eq(page.key, sql`${pageKey}`))
    .limit(1)

  return results.length > 0 ? [results[0].like ?? 0, results[0].view ?? 0] : [0, 0]
}
