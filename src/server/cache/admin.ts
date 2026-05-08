import type { AdminCacheStatsDto, ClearCacheResultDto, ClearCacheTarget } from '@/shared/cache-types'

import { clearAllBuckets, clearBucket, getBucket, getCacheBuckets, snapshotAllBuckets } from '@/server/cache/buckets'
import { ActionFailure } from '@/server/route-helpers/api-handler'

export type { AdminCacheStatsDto, ClearCacheResultDto, ClearCacheTarget } from '@/shared/cache-types'

export async function getAdminCacheStats(): Promise<AdminCacheStatsDto> {
  const buckets = await snapshotAllBuckets()
  const total = buckets.reduce((sum, bucket) => sum + bucket.keyCount, 0)
  return { buckets, total, generatedAt: new Date().toISOString() }
}

export async function clearAdminCache(target: ClearCacheTarget): Promise<ClearCacheResultDto> {
  if (target === 'all') {
    const removed = await clearAllBuckets()
    const cleared = getCacheBuckets().map((bucket) => ({
      bucketId: bucket.id,
      label: bucket.label,
      removed: removed[bucket.id] ?? 0,
    }))
    const total = cleared.reduce((sum, entry) => sum + entry.removed, 0)
    return { cleared, total, refreshedStats: await getAdminCacheStats() }
  }

  const bucket = getBucket(target)
  if (!bucket) {
    // The Zod schema on the API surface should have caught this already;
    // this branch is the belt-and-braces guard for code paths (tests,
    // future internal callers) that bypass the schema.
    throw new ActionFailure(400, `未知的缓存分组：${target}`)
  }
  const removed = await clearBucket(bucket)
  return {
    cleared: [{ bucketId: bucket.id, label: bucket.label, removed }],
    total: removed,
    refreshedStats: await getAdminCacheStats(),
  }
}
