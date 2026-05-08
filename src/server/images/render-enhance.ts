import type { ImageRow } from '@/server/db/types'

import { storage } from '@/server/cache/storage'
import { findImagesByStoragePaths } from '@/server/db/query/image'
import { getPublicBaseUrl } from '@/server/images/storage'
import { getLogger } from '@/server/logger'
import { ActionFailure } from '@/server/route-helpers/api-handler'
import { requireBlogSettingsSection } from '@/shared/blog-config'

// Image metadata resolver. Looks up matching `image` rows by
// `storagePath` and returns width, height, thumbhash, and the
// cache-busted public URL.
//
// `<img src>` is matched against the configured S3 `publicBaseUrl`
// (e.g. `https://cdn.example.com`); a matching prefix resolves to an
// `image` row by stripping the base and looking up the trailing path.
// The `publicBaseUrl` is honoured even after the admin flips
// `storage.enabled` off so historical rows keep rendering. Absolute
// URLs whose host no longer matches the current asset host but whose
// path still points at `/images/...` are also resolved as S3 keys.
//
// The lookup is fronted by a Redis-backed cache (the `image-meta`
// bucket, manageable from `/wp-admin/settings/cache`) so a hot post
// never hammers the DB AND so multiple SSR replicas share the warm
// rows. Concurrent loads for the same `storagePath` collapse to a
// single DB round-trip via `createInflight` — the per-process layer
// that the old `lru-cache` happened to also provide. The upload
// service still calls `invalidateImageEnhanceCacheFor` after
// create / update / delete; that just deletes the key in Redis.

const log = getLogger('images.render-enhance')

// Slim shape we cache. Keeping the Redis payload to the four fields
// this module actually reads (a) shrinks the bytes on the wire, (b)
// sidesteps the `bigint` (`id`, `byteSize`, `uploaderId`) and `Date`
// (`createdAt`, `updatedAt`, `deletedAt`) JSON serialisation traps
// on `ImageRow`, and (c) makes "we asked the DB and there's no row"
// trivially expressible as `{ found: false }`.
interface CachedImageMetaPresent {
  found: true
  storagePath: string
  width: number
  height: number
  thumbhash: string | null
  updatedAtMs: number
}
interface CachedImageMetaMissing {
  found: false
}
type CachedImageMeta = CachedImageMetaPresent | CachedImageMetaMissing

function rowToCached(row: ImageRow): CachedImageMetaPresent {
  return {
    found: true,
    storagePath: row.storagePath,
    width: row.width,
    height: row.height,
    thumbhash: row.thumbhash,
    updatedAtMs: row.updatedAt.getTime(),
  }
}

// Bucket prefix + TTL pulled from the live snapshot so an admin
// rename in `/wp-admin/settings/cache` applies on the next read /
// write. Old keys under the previous prefix age out at their stored
// TTL — there's no migration step.
function bucket(): { prefix: string; ttlSeconds: number } {
  return requireBlogSettingsSection('cache').cache.imageMeta
}

function cacheKey(storagePath: string): string {
  return `${bucket().prefix}${storagePath}`
}

// In-process coalescer. The historical `lru-cache` provided this for
// free because lookups were synchronous; with Redis fronting the
// store we need an explicit inflight map so a burst of concurrent
// requests for the same `storagePath` collapses to one DB call
// instead of N parallel ones — the worst case the old design quietly
// avoided.
const requests = new Map<string, Promise<CachedImageMeta>>()

async function readMeta(storagePath: string): Promise<CachedImageMeta> {
  const pending = requests.get(storagePath)
  if (pending !== undefined) {
    return pending
  }
  const promise = (async () => {
    try {
      const cached = await storage.getItem<CachedImageMeta>(cacheKey(storagePath))
      if (cached !== null) {
        return cached
      }
      const rows = await findImagesByStoragePaths([storagePath])
      const row = rows[0] ?? null
      const value: CachedImageMeta = row !== null ? rowToCached(row) : { found: false }
      try {
        await storage.setItem(cacheKey(storagePath), value, { ttl: bucket().ttlSeconds })
      } catch (error) {
        log.warn('Failed to write image-meta cache; continuing without warmth', { storagePath, error })
      }
      return value
    } finally {
      requests.delete(storagePath)
    }
  })()
  requests.set(storagePath, promise)
  return promise
}

async function readManyMeta(storagePaths: string[]): Promise<Map<string, CachedImageMeta>> {
  // Parallelise so a 30-image post warms up in one tick instead of
  // 30 sequential round-trips. The inflight map dedupes within the
  // batch, and `Promise.all` lets us pipeline the Redis reads.
  const out = new Map<string, CachedImageMeta>()
  await Promise.all(
    storagePaths.map(async (storagePath) => {
      out.set(storagePath, await readMeta(storagePath))
    }),
  )
  return out
}

/** Drop a single entry from the resolution cache (called by the upload service after a write). */
export async function invalidateImageEnhanceCacheFor(storagePath: string): Promise<void> {
  requests.delete(storagePath)
  try {
    await storage.removeItem(cacheKey(storagePath))
  } catch (error) {
    log.warn('Failed to invalidate image-meta cache key', { storagePath, error })
  }
}

/**
 * Drop every key under the configured `image-meta` prefix. Used by
 * tests + the rare "I just batch-imported 10k rows from the legacy
 * site, don't trust the cache" admin flow. Production callers should
 * prefer `clearBucket` from `@/server/cache/buckets` so the admin
 * panel's per-bucket UI stays the single source of truth.
 */
export async function clearImageEnhanceCache(): Promise<void> {
  requests.clear()
  // Match the SCAN+UNLINK shape used by `server/cache/buckets.ts`
  // rather than depending on it (would create a server→server cycle
  // the `cache.buckets` module doesn't have today). Test usage is
  // the dominant caller, so a slow O(n) sweep is acceptable.
  const prefix = bucket().prefix
  const keys = await storage.getKeys(prefix)
  await Promise.all(
    keys.map(async (key) => {
      try {
        await storage.removeItem(key)
      } catch (error) {
        log.warn('Failed to clear image-meta key', { key, error })
      }
    }),
  )
}

interface ImageEnhancement {
  width: number
  height: number
  thumbhash: string | null
  /** Final URL the renderer should write back to `<img src>`. */
  publicUrl: string
}

interface ResolvedSrc {
  src: string
  storagePath: string
}

// Exported for page-import scripts under `scripts/` and any server-side
// resolver that must mirror the SSR enhancer rule set. Pure, no side effects.
export function resolveSrcToStoragePath(src: string, publicBaseUrl: string | null): string | null {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    if (publicBaseUrl !== null) {
      if (src.startsWith(`${publicBaseUrl}/`)) {
        return normalizeStoragePath(src.slice(publicBaseUrl.length + 1))
      }
      if (src === publicBaseUrl) {
        return ''
      }
    }
    // Domain-independent fallback: historical content can carry an
    // absolute image URL whose host no longer matches the current
    // still points at `/images/...`, resolve it as an s3 storage key
    // directly so thumbhash/size enhancement keeps working.
    try {
      const url = new URL(src)
      if (url.pathname.startsWith('/images/')) {
        return normalizeStoragePath(url.pathname.slice(1))
      }
    } catch {
      // Malformed URL — fall through to "no match".
    }
    return null
  }
  if (src.startsWith('/images/')) {
    return normalizeStoragePath(src.slice(1))
  }
  if (src.startsWith('images/')) {
    return normalizeStoragePath(src)
  }
  return null
}

function normalizeStoragePath(storagePath: string): string {
  // Historical URLs can carry on-the-fly transform suffixes (e.g.
  // `!upyun520/...`). DB rows store the original key only.
  const bangIndex = storagePath.indexOf('!')
  const withoutTransform = bangIndex >= 0 ? storagePath.slice(0, bangIndex) : storagePath
  return withoutTransform
}

async function resolveSources(links: string[]): Promise<Map<string, ImageEnhancement>> {
  const out = new Map<string, ImageEnhancement>()

  let publicBaseUrl: string | null = null
  try {
    publicBaseUrl = getPublicBaseUrl()
  } catch (error) {
    if (!(error instanceof ActionFailure) && !(error instanceof Error && /missing|hydrated/.test(error.message))) {
      throw error
    }
    // Settings missing — no source can resolve until the admin
    // configures the localization asset host.
  }

  const candidates: ResolvedSrc[] = []
  for (const src of links) {
    const storagePath = resolveSrcToStoragePath(src, publicBaseUrl)
    if (storagePath === null) {
      continue
    }
    candidates.push({ src, storagePath })
  }

  if (candidates.length === 0) {
    return out
  }

  let cached: Map<string, CachedImageMeta>
  try {
    cached = await readManyMeta(candidates.map((c) => c.storagePath))
  } catch (error) {
    log.warn('Failed to resolve image metadata; rendering naked images', { error })
    return out
  }

  for (const { src, storagePath } of candidates) {
    const meta = cached.get(storagePath)
    if (meta === undefined || !meta.found) {
      continue
    }
    out.set(src, toEnhancement(meta, publicBaseUrl))
  }

  return out
}

function toEnhancement(meta: CachedImageMetaPresent, publicBaseUrl: string | null): ImageEnhancement {
  return {
    width: meta.width,
    height: meta.height,
    thumbhash: meta.thumbhash,
    publicUrl: resolvePublicUrl(meta, publicBaseUrl),
  }
}

function resolvePublicUrl(meta: CachedImageMetaPresent, publicBaseUrl: string | null): string {
  // `buildPublicUrl` reads the live settings; passing the cached
  // `publicBaseUrl` keeps the join consistent with what the resolver
  // matched against.
  if (publicBaseUrl === null) {
    return meta.storagePath
  }
  const tail = meta.storagePath.startsWith('/') ? meta.storagePath.slice(1) : meta.storagePath
  return appendCacheBuster(`${publicBaseUrl}/${tail}`, meta.updatedAtMs)
}

function appendCacheBuster(url: string, version: number): string {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${version}`
}

/**
 * Build the public URL for a stored image by joining the live
 * `publicBaseUrl` with the row's `storagePath`. Lives here instead of
 * in `s3-client` so SSR call sites that only need a URL stay free of
 * the AWS SDK. Throws when the storage section is missing or the
 * `publicBaseUrl` is empty.
 */
export function buildPublicUrl(storagePath: string): string {
  const publicBaseUrl = getPublicBaseUrl()
  if (publicBaseUrl === null) {
    throw new ActionFailure(503, '请先在 /wp-admin/settings/assets 配置 S3 公共访问基地址')
  }
  const tail = storagePath.startsWith('/') ? storagePath.slice(1) : storagePath
  return `${publicBaseUrl}/${tail}`
}

// ---------------------------------------------------------------------------
// Cover-image lookup (post / page / friend covers)
// ---------------------------------------------------------------------------

export interface ImageThumbhashLookup {
  width: number
  height: number
  thumbhash?: string
  /**
   * Cache-busted public URL derived from the live `image` row's
   * `updatedAt`. Callers that store covers as a frozen URL snapshot
   * (page `cover`, post frontmatter `cover`, friend `poster`, …)
   * should overwrite their stored URL with this value at render
   * time so a re-upload to the same `image` row immediately
   * invalidates browser / CDN caches without forcing the operator
   * to re-pick the cover from the library.
   *
   * `null` when the storage section is unconfigured (no
   * `publicBaseUrl` to join against) — callers should keep their
   * original `src` in that case.
   */
  publicUrl: string | null
}

/**
 * Resolve a single image URL (post cover, friend poster, …) to its
 * width / height / thumbhash. Hits the same Redis-backed cache as
 * the HTML enhancer above, so cover lookups during catalog hydration
 * share warmth with body-image lookups during render.
 *
 * Returns `null` when the URL doesn't resolve to any `image` row.
 */
export async function loadImageThumbhash(src: string): Promise<ImageThumbhashLookup | null> {
  if (src === '') {
    return null
  }

  let publicBaseUrl: string | null = null
  try {
    publicBaseUrl = getPublicBaseUrl()
  } catch {
    // Settings unconfigured — fall through; only `external` rows can resolve.
  }

  const storagePath = resolveSrcToStoragePath(src, publicBaseUrl)
  if (storagePath === null) {
    return null
  }

  let meta: CachedImageMeta
  try {
    meta = await readMeta(storagePath)
  } catch (error) {
    log.warn('Failed to resolve image metadata for cover', { src, error })
    return null
  }

  if (!meta.found) {
    return null
  }
  return {
    width: meta.width,
    height: meta.height,
    thumbhash: meta.thumbhash ?? undefined,
    publicUrl: publicBaseUrl === null ? null : resolvePublicUrl(meta, publicBaseUrl),
  }
}

export interface ResolvedImageMeta {
  thumbhash?: string
  width?: number
  height?: number
}

/**
 * Resolve a list of image URLs to their metadata (width, height, thumbhash).
 * Returns a map keyed on the **original** `src` so that callers can match
 * against the raw `src` attribute emitted by MDX / React without worrying
 * about cache-buster suffixes or public-base-url rewrites.
 */
export async function resolveImageMetaBySources(links: string[]): Promise<Map<string, ResolvedImageMeta>> {
  const enhancements = await resolveSources(links)
  const out = new Map<string, ResolvedImageMeta>()
  for (const [src, enhancement] of enhancements) {
    const meta: ResolvedImageMeta = {}
    if (enhancement.thumbhash !== null && enhancement.thumbhash !== '') {
      meta.thumbhash = enhancement.thumbhash
    }
    meta.width = enhancement.width
    meta.height = enhancement.height
    out.set(src, meta)
  }
  return out
}
