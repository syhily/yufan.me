import type { CacheBucket, CacheBucketId, CacheBucketStats } from '@/shared/cache-types'

import { redisInstance } from '@/server/cache/storage'
import { getLogger } from '@/server/logger'
import { requireBlogSettingsSection } from '@/shared/blog-config'

const log = getLogger('cache.buckets')

// Registry of admin-clearable Redis cache buckets. The bucket ID
// (`og` / `calendar` / `avatar`) is hard-coded because every writer in
// the codebase treats it as a stable discriminator. The user-facing
// PREFIX and TTL are pulled from the live blog-settings snapshot, so a
// rename in the admin panel takes effect on the next read.
//
// Deliberately excludes:
//  - `session:*`         clearing it would log every signed-in user out
//                         and break in-flight CSRF tokens.
//  - `rate-limit:*`      clearing it would let a throttled abuser retry
//                         immediately, defeating the spam wall.
// Those two surfaces stay administered through `vp` shells / Redis CLI,
// and the `cache` settings schema validates against them collisively.
//
// Patterns talk to `redisInstance()` directly so the SCAN MATCH
// expression matches whatever shape the writers currently emit. Going
// through `unstorage`'s `getKeys()` would prepend a `:` separator and
// miss the `og-…` / `calendar-…` / `avatar-…` shapes entirely.
export type { CacheBucket, CacheBucketId, CacheBucketStats } from '@/shared/cache-types'

// Static metadata. The dynamic prefix / TTL / pattern slots are filled
// in by `getCacheBuckets()` from the live snapshot. `as const` keeps
// the ID list typed as the literal tuple so callers can derive Zod
// enums and discriminated unions without losing type information.
const BUCKET_META = [
  {
    id: 'og',
    label: 'OG 图缓存',
    description:
      '/images/og/:slug.png 的渲染结果，键形如 ${prefix}${slug}-${hash}。修改 OG 尺寸或文章封面 / 摘要后清理。',
  },
  {
    id: 'calendar',
    label: '侧边栏日历缓存',
    description: '/images/calendar/:date.png 的渲染结果，键形如 ${prefix}${yyyy-MM-dd}。一天后会自动失效。',
  },
  {
    id: 'avatar',
    label: 'Gravatar 头像缓存',
    description:
      '/images/avatar/:hash.png 缓存的头像字节，键形如 ${prefix}${hash}。用户更换头像后清理可让访客立即看到新头像。',
  },
  {
    id: 'image-meta',
    label: '图片元数据缓存',
    description:
      'SSR 渲染时 storagePath → image 行的查询结果（宽 / 高 / thumbhash），键形如 ${prefix}${storagePath}。在图片库批量上传或导入旧站数据后清理一次即可。',
  },
  {
    id: 'comments-md',
    label: '评论 Markdown 渲染缓存',
    description:
      '评论与分类描述经 marked + shiki + sanitize 后的 HTML，键形如 ${prefix}${sha256(content)}。修改 shiki 主题或安全白名单后清理一次即可。',
  },
] as const satisfies readonly { id: CacheBucketId; label: string; description: string }[]

/**
 * Build the bucket list from the live blog-settings snapshot. Reading
 * fresh on every call is intentional — it costs nothing (in-process
 * `Map` lookup) and ensures admin renames are immediately visible to
 * `getAdminCacheStats()` / `clearAdminCache()`.
 */
export function getCacheBuckets(): CacheBucket[] {
  const cache = requireBlogSettingsSection('cache').cache
  return BUCKET_META.map((meta) => {
    const slot = cache[meta.id]
    return {
      id: meta.id,
      label: meta.label,
      description: meta.description,
      prefix: slot.prefix,
      ttlSeconds: slot.ttlSeconds,
      pattern: `${slot.prefix}*`,
    }
  })
}

export function getBucket(id: CacheBucketId): CacheBucket | undefined {
  return getCacheBuckets().find((bucket) => bucket.id === id)
}

// SCAN COUNT hint — bigger values trade Redis CPU per call for fewer
// network round-trips. 500 keeps each SCAN call cheap on the server
// while typical buckets (OG / avatar) finish in 1–2 round-trips.
const SCAN_COUNT = 500

/** Async generator over every key matching `pattern`, in SCAN batches. */
async function* scanKeys(pattern: string): AsyncGenerator<string[]> {
  const redis = redisInstance()
  let cursor = '0'
  do {
    const [nextCursor, batch] = (await redis.scan(cursor, 'MATCH', pattern, 'COUNT', SCAN_COUNT)) as [string, string[]]
    cursor = nextCursor
    if (batch.length > 0) {
      yield batch
    }
  } while (cursor !== '0')
}

/** Count keys matching the bucket pattern via SCAN (non-blocking). */
export async function countBucket(bucket: CacheBucket): Promise<number> {
  let total = 0
  for await (const batch of scanKeys(bucket.pattern)) {
    total += batch.length
  }
  return total
}

// UNLINK in batches so we never block Redis on a single-shot DEL of
// thousands of keys. UNLINK frees memory asynchronously on the Redis
// side too, which is the right tool for cache eviction.
const UNLINK_BATCH = 200

/** Delete every key matching the bucket pattern; returns the number removed. */
export async function clearBucket(bucket: CacheBucket): Promise<number> {
  const redis = redisInstance()
  let removed = 0
  for await (const batch of scanKeys(bucket.pattern)) {
    for (let offset = 0; offset < batch.length; offset += UNLINK_BATCH) {
      const slice = batch.slice(offset, offset + UNLINK_BATCH)
      if (slice.length === 0) {
        continue
      }
      try {
        const deleted = await redis.unlink(...slice)
        removed += Number(deleted)
      } catch (error) {
        log.error('Failed to UNLINK cache batch', { bucket: bucket.id, error, batchSize: slice.length })
        throw error
      }
    }
  }
  return removed
}

/** Aggregate counts across every registered bucket. */
export async function snapshotAllBuckets(): Promise<CacheBucketStats[]> {
  return Promise.all(
    getCacheBuckets().map(async (bucket) => ({
      id: bucket.id,
      label: bucket.label,
      description: bucket.description,
      prefix: bucket.prefix,
      ttlSeconds: bucket.ttlSeconds,
      pattern: bucket.pattern,
      keyCount: await countBucket(bucket),
    })),
  )
}

/** Clear every registered bucket; returns the per-bucket removed counts. */
export async function clearAllBuckets(): Promise<Record<CacheBucketId, number>> {
  const buckets = getCacheBuckets()
  const entries = await Promise.all(buckets.map(async (bucket) => [bucket.id, await clearBucket(bucket)] as const))
  return Object.fromEntries(entries) as Record<CacheBucketId, number>
}

/** Immutable list of bucket IDs in registration order. */
export { CACHE_BUCKET_IDS } from '@/shared/cache-types'
