// Comment-domain cache layer.
//
// Currently a placeholder so the domain follows the locked vocabulary
// (schema.ts / repo.ts / service.ts / projection.ts / cache.ts).
// Redis-backed caching for comment listings or counts can be added here
// when profiling shows a hot path that benefits from it.

export const commentCache = {
  /** No-op placeholder until Redis-backed caching is implemented. */
  enabled: false,
}
