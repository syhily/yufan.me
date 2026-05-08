import { LRUCache } from 'lru-cache'

import type { ImageRow } from '@/server/db/types'

import { findImagesByStoragePaths } from '@/server/db/query/image'
import { getPublicBaseUrl } from '@/server/images/storage'
import { getLogger } from '@/server/logger'
import { ActionFailure } from '@/server/route-helpers/api-handler'

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
// path still points at `/images/...` are also resolved as S3 keys,
//
// The lookup is fronted by a process-level LRU keyed on the resolved
// `storagePath` so a hot post never hammers the DB. The upload service
// invalidates entries when an image is created/updated/deleted.

const log = getLogger('images.render-enhance')

const RESOLUTION_CACHE_TTL_MS = 5 * 60 * 1000

// LRUCache requires a non-nullish value type, but we genuinely want to
// cache "we asked the DB and there's no row" so the next render also
// skips the lookup. Wrap the row in a single-property holder so the
// cache value type is always non-null; readers unwrap `.row`.
interface CachedImageRow {
  row: ImageRow | null
}

const resolutionCache = new LRUCache<string, CachedImageRow>({
  max: 5000,
  ttl: RESOLUTION_CACHE_TTL_MS,
  allowStale: false,
})

/** Drop a single entry from the resolution cache (called by the upload service after a write). */
export function invalidateImageEnhanceCacheFor(storagePath: string): void {
  resolutionCache.delete(storagePath)
}

/** Drop the entire cache (used by tests + the rare "rotate publicBaseUrl" path). */
export function clearImageEnhanceCache(): void {
  resolutionCache.clear()
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

function resolveSrcToStoragePath(src: string, publicBaseUrl: string | null): string | null {
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

  // Split candidates by cache hit/miss so we only round-trip to the DB
  // for paths we haven't seen recently.
  const missing: string[] = []
  const cachedRows = new Map<string, ImageRow | null>()
  for (const { storagePath } of candidates) {
    const hit = resolutionCache.get(storagePath)
    if (hit === undefined) {
      missing.push(storagePath)
    } else {
      cachedRows.set(storagePath, hit.row)
    }
  }

  if (missing.length > 0) {
    try {
      const rows = await findImagesByStoragePaths(missing)
      const found = new Map<string, ImageRow>()
      for (const row of rows) {
        found.set(row.storagePath, row)
      }
      for (const storagePath of missing) {
        const row = found.get(storagePath) ?? null
        resolutionCache.set(storagePath, { row })
        cachedRows.set(storagePath, row)
      }
    } catch (error) {
      log.warn('Failed to resolve image metadata; rendering naked images', { error })
      // Don't poison the cache on transient DB errors.
    }
  }

  for (const { src, storagePath } of candidates) {
    const row = cachedRows.get(storagePath)
    if (row === undefined || row === null) {
      continue
    }
    out.set(src, toEnhancement(row, publicBaseUrl))
  }

  return out
}

function toEnhancement(row: ImageRow, publicBaseUrl: string | null): ImageEnhancement {
  return {
    width: row.width,
    height: row.height,
    thumbhash: row.thumbhash,
    publicUrl: resolvePublicUrl(row, publicBaseUrl),
  }
}

function resolvePublicUrl(row: ImageRow, publicBaseUrl: string | null): string {
  // `buildPublicUrl` reads the live settings; passing the cached
  // `publicBaseUrl` keeps the join consistent with what the resolver
  // matched against.
  if (publicBaseUrl === null) {
    return row.storagePath
  }
  const tail = row.storagePath.startsWith('/') ? row.storagePath.slice(1) : row.storagePath
  return appendCacheBuster(`${publicBaseUrl}/${tail}`, row.updatedAt.getTime())
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
}

/**
 * Resolve a single image URL (post cover, friend poster, …) to its
 * width / height / thumbhash. Hits the same DB-backed LRU as the HTML
 * enhancer above, so cover lookups during catalog hydration share the
 * cache with body-image lookups during render.
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

  const cached = resolutionCache.get(storagePath)
  let row: ImageRow | null
  if (cached !== undefined) {
    row = cached.row
  } else {
    try {
      const rows = await findImagesByStoragePaths([storagePath])
      row = rows[0] ?? null
      resolutionCache.set(storagePath, { row })
    } catch (error) {
      log.warn('Failed to resolve image metadata for cover', { src, error })
      return null
    }
  }

  if (row === null) {
    return null
  }
  return {
    width: row.width,
    height: row.height,
    thumbhash: row.thumbhash ?? undefined,
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
