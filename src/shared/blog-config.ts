// Runtime half of the blog-config module. The pure-types half lives in
// `@/shared/blog-config-types` and is re-exported below so existing
// `import { … } from '@/shared/blog-config'` call sites keep working.
//
// Splitting the file lets pure-UI consumers (notably the per-section
// React contexts file under `src/ui/lib/`) import only the types file
// and stay out of the snapshot-slot import graph — which matters
// because the slot reaches into `globalThis` and is a runtime side
// effect.
//
// Lives in `@/shared/` (not `@/server/`) on purpose: this module is
// reached transitively from route `meta()` exports (via
// `@/server/seo/meta`), and `meta()` runs on the client too — so
// anything imported from it ends up in the browser bundle. Keeping the
// reader here keeps the client bundle free of `pg` / `drizzle-orm` while
// still letting SSR hand the latest DB-backed values to the live route
// loaders.
//
// The writer half (DB query + hydration + refresh-on-write) lives in
// `@/server/settings/snapshot` and stays server-only. Both modules talk
// through the same module-internal slot via the
// `BLOG_SETTINGS_SNAPSHOT_SLOT` symbol so a single in-process snapshot
// is observable everywhere.
//
// The slot is **not** synced from the client tree at render time. SSR
// hydrates it once at boot; client-side it stays `null` because the
// React contexts (`<BlogSettingsProvider>`) are the canonical source of
// settings on the browser side. Any helper that historically reached
// for the snapshot from a `meta()` callback now takes the bundle as an
// explicit argument extracted from `Route.MetaArgs.matches`.
//
// On a fresh deployment that hasn't been installed yet, the snapshot
// returns `null`: the install gate
// (`@/server/middleware/install-gate`) catches every non-install
// request before any consumer reaches for the snapshot, but defensive
// callers should still guard against the possibility — see the
// `require…` helpers below.

import type { BlogSettingsBundle } from '@/shared/blog-config-types'

import { CACHE_BUCKET_FALLBACKS, type CacheBucketSlot } from '@/shared/cache-types'

export type {
  AssetsSettings,
  BlogSettingsBundle,
  CacheSettings,
  CommentsSettings,
  ContentSettings,
  FooterSettings,
  MailSettings,
  NavigationItem,
  NavigationSettings,
  RateLimitBucket,
  RateLimitSettings,
  SearchSettings,
  SeoSettings,
  SidebarSettings,
  SiteIdentitySettings,
  SocialItem,
  SocialsSettings,
} from '@/shared/blog-config-types'

const globalForSnapshot = globalThis as unknown as {
  blogSettingsSnapshot: BlogSettingsBundle | null | undefined
  blogSettingsHydration: Promise<BlogSettingsBundle | null> | undefined
}

type CacheSettingsNonNull = NonNullable<BlogSettingsBundle['cache']>
type CacheBucketKey = keyof CacheSettingsNonNull['cache']

function isCacheBucketSlotLike(value: unknown): value is CacheBucketSlot {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { prefix?: unknown }).prefix === 'string' &&
    typeof (value as { ttlSeconds?: unknown }).ttlSeconds === 'number'
  )
}

function withCacheFallbacks(value: CacheSettingsNonNull): CacheSettingsNonNull {
  const cache = value.cache as Partial<CacheSettingsNonNull['cache']>
  const fallback = CACHE_BUCKET_FALLBACKS as Record<CacheBucketKey, CacheBucketSlot>
  return {
    ...value,
    cache: {
      og: isCacheBucketSlotLike(cache.og) ? cache.og : fallback.og,
      calendar: isCacheBucketSlotLike(cache.calendar) ? cache.calendar : fallback.calendar,
      avatar: isCacheBucketSlotLike(cache.avatar) ? cache.avatar : fallback.avatar,
      imageMeta: isCacheBucketSlotLike(cache.imageMeta) ? cache.imageMeta : fallback.imageMeta,
      embeddingSearch: isCacheBucketSlotLike(cache.embeddingSearch) ? cache.embeddingSearch : fallback.embeddingSearch,
      searchResult: isCacheBucketSlotLike(cache.searchResult) ? cache.searchResult : fallback.searchResult,
    },
  }
}

// `BLOG_SETTINGS_SNAPSHOT_SLOT` is the cross-module bridge between the
// shared reader and the server-only writer in
// `@/server/settings/snapshot`. The export is INTENTIONALLY namespaced
// under a non-obvious symbol so accidental consumers — anything that
// isn't the snapshot writer — can't import it without thinking. The
// snapshot writer re-exports a typed `set…ForServer()` helper that
// uses this slot internally; the `set…` functions are not exposed on
// the shared module's public surface.
//
// Tests that need to bypass the writer (because their `vi.mock` call
// would otherwise replace it with a stub) can reach for the same
// helper via the snapshot module's `setBlogSettingsBundleForTests`
// export, which keeps the test path inside the type system.
export interface BlogSettingsSnapshotSlot {
  read: () => BlogSettingsBundle | null
  write: (value: BlogSettingsBundle | null | undefined) => void
  readHydration: () => Promise<BlogSettingsBundle | null> | undefined
  writeHydration: (value: Promise<BlogSettingsBundle | null> | undefined) => void
}

export const BLOG_SETTINGS_SNAPSHOT_SLOT: BlogSettingsSnapshotSlot = {
  read: () => globalForSnapshot.blogSettingsSnapshot ?? null,
  write: (value) => {
    globalForSnapshot.blogSettingsSnapshot = value
  },
  readHydration: () => globalForSnapshot.blogSettingsHydration,
  writeHydration: (value) => {
    globalForSnapshot.blogSettingsHydration = value
  },
}

/**
 * Synchronous accessor for the bucketed settings bundle. Returns
 * `null` when no DB rows have been written yet (i.e. the install flow
 * hasn't been completed) AND nothing else has populated the snapshot
 * slot. Individual section fields inside the bundle may also be `null`
 * for sections the admin hasn't visited yet.
 *
 * Server-side this is a hot path that runs on every request through
 * `requireBlogSettingsSection()`. Client-side this returns `null`
 * unless the snapshot is being explicitly populated for a test; UI
 * components must read settings through the per-section React contexts
 * (`useFooterSettings`, …) instead of this helper.
 */
export function getBlogSettingsBundleSync(): BlogSettingsBundle | null {
  return BLOG_SETTINGS_SNAPSHOT_SLOT.read()
}

/**
 * Strict accessor for the bundle. Throws when the snapshot has not
 * been hydrated yet — code paths reaching this far past the install
 * gate should never see `null`, so a regression here is a programmer
 * error worth surfacing loudly.
 */
export function requireBlogSettingsBundle(): BlogSettingsBundle {
  const bundle = getBlogSettingsBundleSync()
  if (bundle === null) {
    throw new Error('Blog settings have not been hydrated yet. The install gate should have intercepted this request.')
  }
  return bundle
}

/**
 * Strict per-section accessor for the bundle. Same gate semantics as
 * `requireBlogSettingsBundle` and additionally asserts the requested
 * section row was seeded. Saves the caller from inlining either a
 * non-null assertion (`!`) or a manual `if (section === null) throw`
 * at every call site that reaches into `requireBlogSettingsBundle()`.
 *
 * The install flow seeds every section up front (and
 * `loadSettingsFromDb` lazily backfills any missing optional section
 * before returning the snapshot — see AGENTS.md §"Configuration &
 * Install Gate"), so post-install this assertion can only fail if a
 * row was manually truncated.
 *
 * Example:
 *
 *   const content = requireBlogSettingsSection('content')
 *   const total = content.pagination.posts
 */
export function requireBlogSettingsSection(section: 'cache'): NonNullable<BlogSettingsBundle['cache']>
export function requireBlogSettingsSection<K extends Exclude<keyof BlogSettingsBundle, 'cache'>>(
  section: K,
): NonNullable<BlogSettingsBundle[K]>
export function requireBlogSettingsSection(section: keyof BlogSettingsBundle) {
  const value = requireBlogSettingsBundle()[section]
  if (value === null) {
    throw new Error(
      `Blog settings section '${section}' is missing from the snapshot. ` +
        'The install flow seeds every section up front, so this usually ' +
        'means a row was manually truncated. Re-run install or restore from backup.',
    )
  }
  if (section === 'cache') {
    return withCacheFallbacks(value as CacheSettingsNonNull)
  }
  return value
}
