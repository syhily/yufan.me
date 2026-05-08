export type CacheBucketId = 'og' | 'calendar' | 'avatar'

export const CACHE_BUCKET_IDS = ['og', 'calendar', 'avatar'] as const satisfies readonly [
  CacheBucketId,
  ...CacheBucketId[],
]

export interface CacheBucket {
  id: CacheBucketId
  label: string
  description: string
  prefix: string
  ttlSeconds: number
  pattern: string
}

export interface CacheBucketStats extends CacheBucket {
  /** Approximate count from a SCAN sweep, not authoritative under churn. */
  keyCount: number
}

export interface AdminCacheStatsDto {
  buckets: CacheBucketStats[]
  total: number
  generatedAt: string
}

export type ClearCacheTarget = CacheBucketId | 'all'

export interface ClearCacheInput {
  target: ClearCacheTarget
}

export interface ClearCacheResultDto {
  cleared: { bucketId: CacheBucketId; label: string; removed: number }[]
  total: number
  refreshedStats: AdminCacheStatsDto
}
