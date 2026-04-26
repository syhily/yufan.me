import { DateTime } from 'luxon'

import config from '@/blog.config'
import {
  commentCountsByPageKeys,
  consumeActiveLikeToken,
  existsActiveLikeToken,
  pageMetricsByKeys,
  pageVoteUp,
  purgeOldLikeTokens,
  recordLikeAndCount,
} from '@/server/db/query/like'
import { decrementPageVotes } from '@/server/db/query/page'
import { makeToken } from '@/shared/security'
import { joinUrl } from '@/shared/urls'

const generatePageKey = (permalink: string): string => joinUrl(config.website, permalink, '/')

export async function increaseLikes(permalink: string): Promise<{ likes: number; token: string }> {
  const pageKey = generatePageKey(permalink)
  // 64 base64url chars ≈ 48 bytes ≈ 384 bits of entropy.
  const token = makeToken(64)
  // Transactional: insert + bump + RETURNING new count run as one statement
  // pair so a concurrent decrement can't race in between and return us
  // yesterday's number.
  const likes = await recordLikeAndCount(token, pageKey)
  return { likes, token }
}

export async function decreaseLikes(permalink: string, token: string) {
  const pageKey = generatePageKey(permalink)
  const consumed = await consumeActiveLikeToken(pageKey, token)
  if (consumed) {
    await decrementPageVotes(pageKey)
  }
}

export async function queryLikes(permalink: string): Promise<number> {
  return pageVoteUp(generatePageKey(permalink))
}

export async function queryMetadata(
  permalinks: string[],
  options: { likes: boolean; views: boolean; comments: boolean },
): Promise<Map<string, { likes: number; views: number; comments: number }>> {
  if (permalinks.length === 0) {
    return new Map()
  }
  const pageKeys = permalinks.map((permalink) => generatePageKey(permalink))
  const [likesAndViewsRows, commentRows] = await Promise.all([
    pageMetricsByKeys(pageKeys),
    options.comments ? commentCountsByPageKeys(pageKeys) : Promise.resolve([]),
  ])

  const likesAndViewsByKey = new Map(likesAndViewsRows.map((row) => [row.key, row]))
  const commentsByKey = new Map(commentRows.map((row) => [row.pageKey, row]))

  const results = new Map<string, { likes: number; views: number; comments: number }>()
  for (const permalink of permalinks) {
    const pageKey = generatePageKey(permalink)
    const likesAndView = likesAndViewsByKey.get(pageKey)
    const commentCount = commentsByKey.get(pageKey)

    results.set(permalink, {
      likes: likesAndView?.like ?? 0,
      views: likesAndView?.view ?? 0,
      comments: commentCount?.count ?? 0,
    })
  }

  return results
}

/**
 * Validate if a like token exists and is valid (not deleted).
 *
 * Token cleanup is owned by `startLikeTokenSweep()` (a guarded
 * `setInterval` on the module-scope global), so this hot path no longer
 * pays a `Math.random()` + opportunistic table scan per call. Dedicated
 * cron jobs can still invoke `purgeStaleLikeTokens()` directly.
 */
export async function validateLikeToken(permalink: string, token: string): Promise<boolean> {
  ensureLikeTokenSweepStarted()
  return existsActiveLikeToken(generatePageKey(permalink), token)
}

/**
 * Physically delete all soft-deleted like tokens older than 30 days. Safe to
 * call from a cron job; also invoked by the in-process sweep below.
 */
export async function purgeStaleLikeTokens(): Promise<void> {
  const thirtyDaysAgo = DateTime.now().minus({ days: 30 }).startOf('day').toJSDate()
  await purgeOldLikeTokens(thirtyDaysAgo)
}

/**
 * In-process sweep timer. Purges soft-deleted like tokens once an hour.
 * Guarded by a `Symbol.for` global so HMR / accidental double imports
 * never spawn duplicate timers in dev.
 */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000
const SWEEP_KEY = Symbol.for('yufan.me/likes/sweep')
type SweepGlobal = { [SWEEP_KEY]?: NodeJS.Timeout }

function ensureLikeTokenSweepStarted(): void {
  const slot = globalThis as unknown as SweepGlobal
  if (slot[SWEEP_KEY] !== undefined) return
  slot[SWEEP_KEY] = setInterval(() => {
    void purgeStaleLikeTokens().catch((err) => {
      console.warn('[likes] background sweep failed', err)
    })
  }, SWEEP_INTERVAL_MS)
  // Don't pin the Node event loop — the timer is purely opportunistic.
  slot[SWEEP_KEY]?.unref?.()
}
