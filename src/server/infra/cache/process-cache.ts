// Process-level TTL cache. Used for lightweight cross-request caching
// where a Redis round-trip would cost more than the recomputation.
//
// IMPORTANT: This is a *process-level* cache. In a multi-process deployment
// (e.g. Node.js cluster mode or multiple containers) each process holds its
// own copy. Cache invalidation only reaches the current process; other
// processes see stale data until their own TTL expires. For deployments where
// strong cache coherency is required, use Redis-backed `storage` instead.

interface CacheEntry<T> {
  value: T
  cachedAt: number
}

export interface ProcessCacheOptions {
  /** Time-to-live in milliseconds. */
  ttlMs: number
}

export function createProcessCache<T>(options: ProcessCacheOptions) {
  let entry: CacheEntry<T> | null = null

  function get(): T | null {
    if (entry === null) {
      return null
    }
    if (Date.now() - entry.cachedAt > options.ttlMs) {
      entry = null
      return null
    }
    return entry.value
  }

  function set(value: T): void {
    entry = { value, cachedAt: Date.now() }
  }

  function clear(): void {
    entry = null
  }

  return { get, set, clear }
}
