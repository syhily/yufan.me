import { storage } from '@/server/cache/storage'

export type InvalidateKind = 'post' | 'page' | 'taxonomy'

type Listener = (kind: InvalidateKind) => void

const listeners = new Set<Listener>()
const CATALOG_VERSION_KEY = 'catalog:snapshot:version'

export function subscribeCatalogInvalidate(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function bumpCatalogVersion(): Promise<void> {
  const now = Date.now()
  await storage.setItem(CATALOG_VERSION_KEY, now, { ttl: 60 * 60 * 24 * 7 })
}

export async function getCatalogVersion(): Promise<number> {
  const value = await storage.getItem<number>(CATALOG_VERSION_KEY)
  return value ?? 0
}

export function invalidateCatalog(kind: InvalidateKind): void {
  for (const listener of listeners) {
    try {
      listener(kind)
    } catch {
      // listener errors are swallowed; each subscriber owns its own resilience.
    }
  }
  // Fire-and-forget: cross-process invalidation via shared version key.
  void bumpCatalogVersion().catch(() => {
    // Swallow Redis errors so a transient outage doesn't break the admin flow.
  })
}
