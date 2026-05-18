// Re-exports from `domains/images/image-meta` for backwards compatibility.
// All new code should import directly from `@/server/domains/images/image-meta`.
export {
  buildPublicUrl,
  clearImageEnhanceCache,
  hydrateImageRefs,
  invalidateImageEnhanceCacheFor,
  loadImageThumbhash,
  resolveImageMetaBySources,
  resolveSrcToStoragePath,
  type ImageThumbhashLookup,
  type ResolvedImageMeta,
} from '@/server/domains/images/image-meta'
