import { BLOG_CONSTANTS, type BlogSettings, DEFAULT_SETTINGS } from '@/shared/blog-defaults'

// Synchronous reader for the in-process blog settings snapshot.
//
// Lives in `@/shared/` (not `@/server/`) on purpose: this module is
// reached transitively from route `meta()` exports (via
// `@/server/seo/meta`), and `meta()` runs on the client too — so
// anything imported from it ends up in the browser bundle. Putting the
// reader here keeps the client bundle free of `pg` / `drizzle-orm` while
// still letting SSR hand the latest DB-backed values to the live route
// loaders.
//
// The writer half (DB query + hydration + refresh-on-write) lives in
// `@/server/settings/snapshot` and stays server-only. Both modules talk
// through the same `globalThis` slot so a single in-process snapshot is
// observable everywhere.
//
// On the client this reader always returns `DEFAULT_SETTINGS` because no
// server hydration ran in that bundle — which matches the historical
// pre-DB behaviour where the static `@/blog.config` literal was the
// single source of truth across the wire.
//
// Bucket-A constants (asset host, locale/timeZone/timeFormat) are
// merged in here from `BLOG_CONSTANTS` so consumers see one combined
// `BlogConfig` shape, exactly like the historical static literal.

const globalForSnapshot = globalThis as unknown as {
  blogSettingsSnapshot: BlogSettings | undefined
  blogSettingsHydration: Promise<BlogSettings> | undefined
}

export interface BlogConfigSnapshot {
  title: BlogSettings['title']
  description: BlogSettings['description']
  website: BlogSettings['website']
  keywords: BlogSettings['keywords']
  author: BlogSettings['author']
  navigation: BlogSettings['navigation']
  socials: BlogSettings['socials']
  settings: {
    asset: (typeof BLOG_CONSTANTS)['asset']
    footer: BlogSettings['settings']['footer']
    locale: (typeof BLOG_CONSTANTS)['locale']
    timeZone: (typeof BLOG_CONSTANTS)['timeZone']
    timeFormat: (typeof BLOG_CONSTANTS)['timeFormat']
    twitter: BlogSettings['settings']['twitter']
    pagination: BlogSettings['settings']['pagination']
    feed: BlogSettings['settings']['feed']
    post: BlogSettings['settings']['post']
    sidebar: BlogSettings['settings']['sidebar']
    comments: BlogSettings['settings']['comments']
    toc: BlogSettings['settings']['toc']
    og: BlogSettings['settings']['og']
  }
}

/**
 * Synchronous accessor for the editable settings slice. Returns the
 * defaults until the first server-side hydration completes; after that
 * it returns the live snapshot (refreshed on every admin write).
 */
export function getBlogSettingsSync(): BlogSettings {
  return globalForSnapshot.blogSettingsSnapshot ?? DEFAULT_SETTINGS
}

/**
 * Combined accessor returning the same `BlogConfig` shape consumers
 * historically imported from `@/blog.config`. The DB-backed editable
 * fields override the seed values; bucket-A constants remain code-side.
 */
export function getBlogConfigSync(): BlogConfigSnapshot {
  const editable = getBlogSettingsSync()
  return {
    title: editable.title,
    description: editable.description,
    website: editable.website,
    keywords: editable.keywords,
    author: editable.author,
    navigation: editable.navigation,
    socials: editable.socials,
    settings: {
      asset: BLOG_CONSTANTS.asset,
      footer: editable.settings.footer,
      locale: BLOG_CONSTANTS.locale,
      timeZone: BLOG_CONSTANTS.timeZone,
      timeFormat: BLOG_CONSTANTS.timeFormat,
      twitter: editable.settings.twitter,
      pagination: editable.settings.pagination,
      feed: editable.settings.feed,
      post: editable.settings.post,
      sidebar: editable.settings.sidebar,
      comments: editable.settings.comments,
      toc: editable.settings.toc,
      og: editable.settings.og,
    },
  }
}

/** Internal: server-only writer uses this to share the slot. */
export function _setBlogSettingsSnapshot(value: BlogSettings | undefined): void {
  globalForSnapshot.blogSettingsSnapshot = value
}

/** Internal: server-only writer uses this to share the slot. */
export function _setBlogSettingsHydration(value: Promise<BlogSettings> | undefined): void {
  globalForSnapshot.blogSettingsHydration = value
}

/** Internal: server-only writer uses this to share the slot. */
export function _getBlogSettingsHydration(): Promise<BlogSettings> | undefined {
  return globalForSnapshot.blogSettingsHydration
}
