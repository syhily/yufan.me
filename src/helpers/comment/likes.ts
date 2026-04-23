import { joinPaths } from '@astrojs/internal-helpers/path'
import { DateTime } from 'luxon'

import config from '@/blog.config'
import * as likeRepo from '@/data/repositories/like'
import * as pageRepo from '@/data/repositories/page'
import { makeToken } from '@/helpers/tools'

const generatePageKey = (permalink: string): string => joinPaths(config.website, permalink, '/')

export async function increaseLikes(permalink: string): Promise<{ likes: number; token: string }> {
  const pageKey = generatePageKey(permalink)
  // 64 base64url chars ≈ 48 bytes ≈ 384 bits of entropy.
  const token = makeToken(64)
  await likeRepo.insertLikeToken(token, pageKey)
  await pageRepo.incrementPageVotes(pageKey)
  return { likes: await queryLikes(permalink), token }
}

export async function decreaseLikes(permalink: string, token: string) {
  const pageKey = generatePageKey(permalink)
  const id = await likeRepo.findActiveLikeId(pageKey, token)
  if (id === null) return
  await likeRepo.softDeleteLike(id)
  await pageRepo.decrementPageVotes(pageKey)
}

export async function queryLikes(permalink: string): Promise<number> {
  return likeRepo.pageVoteUp(generatePageKey(permalink))
}

export async function queryMetadata(
  permalinks: string[],
  options: { likes: boolean; views: boolean; comments: boolean },
): Promise<Map<string, { likes: number; views: number; comments: number }>> {
  if (permalinks.length === 0) {
    return new Map()
  }
  const pageKeys = permalinks.map((permalink) => generatePageKey(permalink))
  const likesAndViews = await likeRepo.pageMetricsByKeys(pageKeys)
  const commentsCounts = options.comments ? await likeRepo.commentCountsByPageKeys(pageKeys) : []

  const results = new Map<string, { likes: number; views: number; comments: number }>()

  for (const permalink of permalinks) {
    const pageKey = generatePageKey(permalink)
    const likesAndView = likesAndViews.find((item) => item.key === pageKey)
    const commentCount = options.comments ? commentsCounts.find((item) => item.pageKey === pageKey) : undefined

    results.set(permalink, {
      likes: likesAndView ? (likesAndView.like ?? 0) : 0,
      views: likesAndView ? (likesAndView.view ?? 0) : 0,
      comments: commentCount ? commentCount.count : 0,
    })
  }

  return results
}

export async function queryLikesAndViews(permalink: string): Promise<[number, number]> {
  return likeRepo.pageVoteUpAndViews(generatePageKey(permalink))
}

/**
 * Probability (0..1) of running the "purge tokens older than 30 days" sweep
 * on a given validate call. The previous implementation ran it on every
 * call which scanned the whole table in production.
 */
const PURGE_PROBABILITY = 0.01

/**
 * Validate if a like token exists and is valid (not deleted).
 *
 * Token cleanup runs probabilistically (~1% of calls) so we get amortized
 * housekeeping without paying a full table scan on every visitor click. A
 * dedicated cron job can call `purgeStaleLikeTokens()` for a deterministic
 * sweep if needed.
 */
export async function validateLikeToken(permalink: string, token: string): Promise<boolean> {
  const pageKey = generatePageKey(permalink)

  if (Math.random() < PURGE_PROBABILITY) {
    // Fire and forget; we don't want token validation to wait on cleanup.
    void purgeStaleLikeTokens().catch(() => {
      /* logger inside purgeStaleLikeTokens */
    })
  }

  return likeRepo.existsLikeToken(pageKey, token)
}

/**
 * Physically delete all soft-deleted like tokens older than 30 days. Safe to
 * call from a cron job; also invoked probabilistically by `validateLikeToken`.
 */
export async function purgeStaleLikeTokens(): Promise<void> {
  const thirtyDaysAgo = DateTime.now().minus({ days: 30 }).startOf('day').toJSDate()
  await likeRepo.purgeOldLikeTokens(thirtyDaysAgo)
}
