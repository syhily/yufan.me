export type CacheBucketId = 'og' | 'calendar' | 'avatar' | 'imageMeta' | 'commentsMd' | 'embeddingSearch'

export interface CacheBucketSlot {
  prefix: string
  ttlSeconds: number
}

export const CACHE_BUCKET_IDS = [
  'og',
  'calendar',
  'avatar',
  'imageMeta',
  'commentsMd',
  'embeddingSearch',
] as const satisfies readonly [CacheBucketId, ...CacheBucketId[]]

export const CACHE_BUCKET_FALLBACKS: Record<CacheBucketId, CacheBucketSlot> = {
  og: { prefix: 'og-', ttlSeconds: 60 * 60 * 24 },
  calendar: { prefix: 'calendar-', ttlSeconds: 60 * 60 * 24 },
  avatar: { prefix: 'avatar-', ttlSeconds: 60 * 60 * 24 },
  imageMeta: { prefix: 'image-meta-', ttlSeconds: 60 * 60 },
  commentsMd: { prefix: 'comments-md-', ttlSeconds: 60 * 60 * 24 },
  embeddingSearch: { prefix: 'embedding-search:', ttlSeconds: 60 * 60 * 24 * 7 },
}

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
