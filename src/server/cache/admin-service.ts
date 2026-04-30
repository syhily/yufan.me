import {
  type CacheBucketId,
  type CacheBucketStats,
  clearAllBuckets,
  clearBucket,
  getBucket,
  getCacheBuckets,
  snapshotAllBuckets,
} from '@/server/cache/buckets'
import { ActionFailure } from '@/server/route-helpers/api-handler'

// DTO returned by the admin "get cache stats" endpoint. The aggregate
// `total` lets the UI render a "全部 N 项" badge without summing on the
// client.
export interface AdminCacheStatsDto {
  buckets: CacheBucketStats[]
  total: number
  generatedAt: string
}

export async function getAdminCacheStats(): Promise<AdminCacheStatsDto> {
  const buckets = await snapshotAllBuckets()
  const total = buckets.reduce((sum, bucket) => sum + bucket.keyCount, 0)
  return { buckets, total, generatedAt: new Date().toISOString() }
}

// Result of a clear operation. `cleared` enumerates per-bucket counts
// (always present, even for single-bucket clears, so the UI can render a
// uniform success toast). `total` is the sum.
export interface ClearCacheResultDto {
  cleared: { bucketId: CacheBucketId; label: string; removed: number }[]
  total: number
  refreshedStats: AdminCacheStatsDto
}

// `'all'` is a magic value that fans out to every registered bucket.
// We accept it as an explicit string in the API contract so the UI
// renders the "全部清空" button as a separate (more conspicuous) button
// rather than a multi-select.
export type ClearCacheTarget = CacheBucketId | 'all'

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
