// Centralised helper for globalThis singletons. HMR / test re-evaluation
// safety is the primary motivation: without this, every module-level
// `let` that caches an expensive initialiser is blown away on hot reload
// and recreated from scratch on the next import.
//
// The Symbol key guarantees uniqueness across the entire runtime (including
// third-party code) and the factory pattern ensures the initialiser runs
// exactly once per process lifetime.
//
// Note: In a multi-process deployment each process gets its own singleton.
// This is fine for stateless / idempotent services (renderers, parsers,
// read-only caches) but must NOT be used for mutable shared state that
// needs cross-process visibility (counters, locks, queues).

export function getOrCreateGlobalSingleton<T>(key: symbol, factory: () => T): T {
  const slot = globalThis as unknown as Record<symbol, T | undefined>
  if (slot[key] === undefined) {
    slot[key] = factory()
  }
  return slot[key]!
}

export function getGlobalSingleton<T>(key: symbol): T | undefined {
  return (globalThis as unknown as Record<symbol, T | undefined>)[key]
}
