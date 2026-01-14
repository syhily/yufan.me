import { joinPaths } from '@astrojs/internal-helpers/path'
import { and, count, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import { DateTime } from 'luxon'
import config from '@/blog.config'
import * as pool from '@/helpers/db/pool'
import { comment, like, page } from '@/helpers/db/schema'
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

export async function queryMetadata(
  permalinks: string[],
  options: { likes: boolean, views: boolean, comments: boolean },
): Promise<Map<string, { likes: number, views: number, comments: number }>> {
  if (permalinks.length === 0) {
    return new Map()
  }
  const pageKeys = permalinks.map(permalink => generatePageKey(permalink))
  const likesAndViews = await pool.db
    .select({ key: page.key, like: page.voteUp, view: page.pv })
    .from(page)
    .where(inArray(page.key, pageKeys))

  const commentsCounts = options.comments
    ? await pool.db
        .select({ pageKey: comment.pageKey, count: count() })
        .from(comment)
        .where(and(inArray(comment.pageKey, pageKeys), eq(comment.isPending, false), isNull(comment.deletedAt)))
        .groupBy(comment.pageKey)
    : []

  const results = new Map()

  for (const permalink of permalinks) {
    const pageKey = generatePageKey(permalink)
    const likesAndView = likesAndViews.find(item => item.key === pageKey)
    const commentCount = options.comments ? commentsCounts.find(item => item.pageKey === pageKey) : undefined

    results.set(permalink, {
      likes: likesAndView ? (likesAndView.like ?? 0) : 0,
      views: likesAndView ? (likesAndView.view ?? 0) : 0,
      comments: commentCount ? (commentCount.count) : 0,
    })
  }

  return results
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

/**
 * Validate if a like token exists and is valid (not deleted)
 * Automatically clears tokens older than 30 days before validation
 * @param permalink - The permalink of the page
 * @param token - The token to validate
 * @returns true if token exists and is valid, false otherwise
 */
export async function validateLikeToken(permalink: string, token: string): Promise<boolean> {
  const pageKey = generatePageKey(permalink)
  // Calculate 30 days ago at midnight (00:00:00) using luxon
  const thirtyDaysAgo = DateTime.now()
    .minus({ days: 30 })
    .startOf('day')
    .toJSDate()

  // First, physically delete all tokens older than 30 days
  await pool.db
    .delete(like)
    .where(lt(like.createdAt, thirtyDaysAgo))

  // Then, query the specific token
  const results = await pool.db
    .select({ id: like.id })
    .from(like)
    .where(and(eq(like.token, token), eq(like.pageKey, pageKey)))
    .limit(1)

  return results.length > 0
}
