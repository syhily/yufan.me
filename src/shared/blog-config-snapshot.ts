import type { BlogConfig, BlogSettings, BlogSettingsBundle } from '@/shared/blog-config'

import { bundleToBlogSettings } from '@/shared/blog-config'

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
// On the client the slot is hydrated from the root loader's
// `blogSettings` field on every render (see `root.tsx`), so client-side
// `meta()` callbacks after a SPA navigation see the same values the
// server saw on the original page render.
//
// On a fresh deployment that hasn't been installed yet, both halves
// return `null`: the install gate (`@/server/install/gate`) catches
// every non-install request before any consumer reaches for the
// snapshot, but defensive callers should still guard against the
// possibility — see `requireBlogConfig` below.

const globalForSnapshot = globalThis as unknown as {
  blogSettingsSnapshot: BlogSettingsBundle | null | undefined
  blogSettingsHydration: Promise<BlogSettingsBundle | null> | undefined
}

/**
 * Synchronous accessor for the bucketed settings bundle. Returns
 * `null` when no DB rows have been written yet (i.e. the install flow
 * hasn't been completed) AND nothing else has populated the snapshot
 * slot. Individual section fields inside the bundle may also be `null`
 * for sections the admin hasn't visited yet.
 */
export function getBlogSettingsBundleSync(): BlogSettingsBundle | null {
  return globalForSnapshot.blogSettingsSnapshot ?? null
}

/**
 * Legacy aggregated reader. Projects the bundle back into the historical
 * `BlogSettings` shape so callers that haven't migrated to the
 * per-section accessors keep working. Returns `null` when either of the
 * install-required sections (`siteIdentity` + `localization`) is
 * missing — the legacy shape has non-optional fields for both.
 *
 * Prefer `getBlogSettingsBundleSync()` and read only the section you
 * need.
 */
export function getBlogSettingsSync(): BlogSettings | null {
  return bundleToBlogSettings(getBlogSettingsBundleSync())
}

/**
 * Combined accessor returning the same `BlogConfig` shape consumers
 * historically imported from `@/blog.config`. After the asset / locale
 * fields moved into the editable document, `BlogConfig` is a 1:1 alias
 * of `BlogSettings` — the indirection is kept for call-site readability.
 *
 * Returns `null` when the deployment has not been installed yet.
 */
export function getBlogConfigSync(): BlogConfig | null {
  return getBlogSettingsSync()
}

/**
 * Strict accessor for code paths that are guaranteed to run AFTER the
 * install gate has admitted the request. Throws an `Error` if the
 * snapshot is unhydrated so a missing-row regression surfaces loudly
 * instead of silently rendering a broken page.
 */
export function requireBlogConfig(): BlogConfig {
  const config = getBlogConfigSync()
  if (config === null) {
    throw new Error('Blog settings have not been hydrated yet. The install gate should have intercepted this request.')
  }
  return config
}

/**
 * Strict accessor for the bundle. Same gate semantics as
 * `requireBlogConfig` but returns the bucketed shape so callers can
 * read individual sections without going through the legacy projection.
 */
export function requireBlogSettingsBundle(): BlogSettingsBundle {
  const bundle = getBlogSettingsBundleSync()
  if (bundle === null) {
    throw new Error('Blog settings have not been hydrated yet. The install gate should have intercepted this request.')
  }
  return bundle
}

/** Internal: server-only writer uses this to share the slot. */
export function _setBlogSettingsSnapshot(value: BlogSettingsBundle | null | undefined): void {
  globalForSnapshot.blogSettingsSnapshot = value
}

/** Internal: server-only writer uses this to share the slot. */
export function _setBlogSettingsHydration(value: Promise<BlogSettingsBundle | null> | undefined): void {
  globalForSnapshot.blogSettingsHydration = value
}

/** Internal: server-only writer uses this to share the slot. */
export function _getBlogSettingsHydration(): Promise<BlogSettingsBundle | null> | undefined {
  return globalForSnapshot.blogSettingsHydration
}
