export type InvalidateKind = 'post' | 'page' | 'taxonomy'

type Listener = (kind: InvalidateKind) => void

const listeners = new Set<Listener>()

export function subscribeCatalogInvalidate(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function invalidateCatalog(kind: InvalidateKind): void {
  for (const listener of listeners) {
    try {
      listener(kind)
    } catch {
      // listener errors are swallowed; each subscriber owns its own resilience.
    }
  }
}
