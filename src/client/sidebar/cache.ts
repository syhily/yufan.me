import type { SidebarSnapshotOutput } from '@/client/api/action-types'
import type { ApiEnvelope } from '@/shared/api-envelope'

import { API_ACTIONS } from '@/client/api/actions'

/**
 * Browser-side cache for `/api/actions/sidebar/snapshot`. The sidebar
 * payload is shared across most public navigations (home, archives,
 * categories, tags, post detail) and only changes when a comment is
 * approved or a new admin signs in. Caching it through the platform
 * `Cache Storage` API gives us:
 *
 * - **Cross-tab dedupe** — the cache is keyed by URL, so two open tabs
 *   navigating between listing pages reuse a single network response.
 * - **SPA acceleration** — the `clientLoader` short-circuits on cache
 *   hits and re-renders the route synchronously instead of round-tripping
 *   through React Router's server loader.
 * - **Stale-while-revalidate** — we always serve the cached payload
 *   first (when fresh enough) and revalidate in the background, so the
 *   user never waits on the network for above-the-fold sidebar widgets.
 *
 * The `loader` (server) remains the source of truth for SSR + first
 * navigation; this module only kicks in on client navigations after
 * hydration.
 */

const CACHE_NAME = 'sidebar-snapshot-v1'
const CACHE_TTL_MS = 5 * 60 * 1000 // Match the server's `private, max-age=60` × 5

interface CachedSnapshot {
  data: SidebarSnapshotOutput
  storedAt: number
}

interface SidebarFetchOptions {
  /** Force a network round-trip and update the cache, even on a hit. */
  bypassCache?: boolean
  /** Abort the underlying fetch (optional; only used for in-flight requests). */
  signal?: AbortSignal
}

// Cache Storage and the `Response` constructor live in the same browser
// global. SSR / Vitest fall through this guard and just hit the network
// (the SSR caller never reaches this module — it imports the SSR
// `loadSidebarData` directly — but the type guard keeps the fetch path
// safe to import from `clientLoader` without an `if (typeof window…)`
// dance at every call site).
function isCacheStorageAvailable(): boolean {
  if (typeof globalThis === 'undefined') {
    return false
  }
  // `caches` is the standard global; some embedded webviews ship without
  // it. Fall back to a network-only path in that case.
  return (
    typeof (globalThis as { caches?: CacheStorage }).caches !== 'undefined' &&
    typeof (globalThis as { Response?: typeof Response }).Response !== 'undefined'
  )
}

async function readCachedSnapshot(): Promise<CachedSnapshot | null> {
  if (!isCacheStorageAvailable()) {
    return null
  }
  try {
    const cache = await caches.open(CACHE_NAME)
    const response = await cache.match(API_ACTIONS.sidebar.snapshot.path)
    if (!response) {
      return null
    }
    return (await response.json()) as CachedSnapshot
  } catch {
    return null
  }
}

/**
 * Seed/refresh the Cache Storage entry from a snapshot the route already
 * has on hand (e.g. the sidebar slice the SSR `loader` ships in the
 * initial HTML). Writing here is best-effort; failures are swallowed so
 * a quota error never breaks the navigation. Exposed publicly so route
 * loaders can prime the cache after a fresh server response.
 */
export async function writeSidebarSnapshotCache(data: SidebarSnapshotOutput): Promise<void> {
  return writeCachedSnapshot(data)
}

async function writeCachedSnapshot(data: SidebarSnapshotOutput): Promise<void> {
  if (!isCacheStorageAvailable()) {
    return
  }
  try {
    const cache = await caches.open(CACHE_NAME)
    const payload: CachedSnapshot = { data, storedAt: Date.now() }
    await cache.put(
      API_ACTIONS.sidebar.snapshot.path,
      new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  } catch {
    /* Cache writes are best-effort — quota errors silently degrade. */
  }
}

async function fetchSidebarFromNetwork(signal: AbortSignal | undefined): Promise<SidebarSnapshotOutput> {
  const response = await fetch(API_ACTIONS.sidebar.snapshot.path, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    throw new Error(`sidebar snapshot fetch failed: HTTP ${response.status}`)
  }
  const envelope = (await response.json()) as ApiEnvelope<SidebarSnapshotOutput>
  if (envelope.error) {
    throw new Error(envelope.error.message)
  }
  if (!envelope.data) {
    throw new Error('sidebar snapshot returned an empty envelope')
  }
  return envelope.data
}

/**
 * Returns the most recent sidebar snapshot, prioritising cached values
 * for instant SPA paints. When the cached entry is older than
 * `CACHE_TTL_MS` we still return it immediately but fire a background
 * revalidation so the next navigation gets fresh data without blocking
 * the current one. `bypassCache: true` skips the cached entry — used
 * after the user signs in/out so admin-mode toggles take effect on the
 * very next page load.
 */
export async function getSidebarSnapshot(options?: SidebarFetchOptions): Promise<SidebarSnapshotOutput> {
  const cached = options?.bypassCache ? null : await readCachedSnapshot()
  const now = Date.now()

  if (cached && now - cached.storedAt < CACHE_TTL_MS) {
    // Fresh hit — return immediately, no network call needed.
    return cached.data
  }

  if (cached) {
    // Stale hit — return the cached value immediately and revalidate in
    // the background. Errors are swallowed; the next navigation will try
    // again.
    void revalidateInBackground()
    return cached.data
  }

  // Miss — block on a real network round-trip.
  const data = await fetchSidebarFromNetwork(options?.signal)
  await writeCachedSnapshot(data)
  return data
}

let revalidateInFlight: Promise<void> | null = null
function revalidateInBackground(): Promise<void> {
  if (revalidateInFlight) {
    return revalidateInFlight
  }
  revalidateInFlight = (async () => {
    try {
      const data = await fetchSidebarFromNetwork(undefined)
      await writeCachedSnapshot(data)
    } catch {
      /* Swallow — background revalidation is best-effort. */
    } finally {
      revalidateInFlight = null
    }
  })()
  return revalidateInFlight
}

/**
 * Forcefully evict the cached sidebar snapshot. Call from the sign-in /
 * sign-out flows so admin-only widgets (pending comments) appear/hide on
 * the next navigation without waiting for the TTL to expire.
 */
export async function invalidateSidebarSnapshot(): Promise<void> {
  if (!isCacheStorageAvailable()) {
    return
  }
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.delete(API_ACTIONS.sidebar.snapshot.path)
  } catch {
    /* No-op on transient cache errors. */
  }
}
