import { findSettingByScope } from '@/server/db/query/setting'
import { getLogger } from '@/server/logger'
import { type BlogSettings, DEFAULT_SETTINGS } from '@/server/settings/defaults'
import {
  _getBlogSettingsHydration,
  _setBlogSettingsHydration,
  _setBlogSettingsSnapshot,
  getBlogConfigSync,
  getBlogSettingsSync,
} from '@/shared/blog-config-snapshot'

const log = getLogger('settings.snapshot')

// Server-only writer for the in-process blog settings snapshot. Owns
// the DB read, the deep-merge with defaults, the lazy hydration on
// first access, and the explicit refresh fired by every admin write.
//
// The synchronous reader (`getBlogConfigSync()` / `getBlogSettingsSync()`)
// lives in `@/shared/blog-config-snapshot` so it can be reached from
// route `meta()` exports — which run on the client too — without
// dragging Drizzle/Postgres into the browser bundle. Both halves share
// the same `globalThis`-backed snapshot slot.

function mergeWithDefaults(stored: unknown): BlogSettings {
  if (!stored || typeof stored !== 'object') {
    return DEFAULT_SETTINGS
  }
  const partial = stored as Partial<BlogSettings>
  const fallback = DEFAULT_SETTINGS

  return {
    title: partial.title ?? fallback.title,
    description: partial.description ?? fallback.description,
    website: partial.website ?? fallback.website,
    keywords: partial.keywords ?? fallback.keywords,
    author: { ...fallback.author, ...partial.author },
    navigation: partial.navigation ?? fallback.navigation,
    socials: partial.socials ?? fallback.socials,
    settings: {
      twitter: partial.settings?.twitter ?? fallback.settings.twitter,
      pagination: { ...fallback.settings.pagination, ...partial.settings?.pagination },
      feed: { ...fallback.settings.feed, ...partial.settings?.feed },
      post: { ...fallback.settings.post, ...partial.settings?.post },
      sidebar: { ...fallback.settings.sidebar, ...partial.settings?.sidebar },
      comments: {
        size: partial.settings?.comments?.size ?? fallback.settings.comments.size,
        avatar: { ...fallback.settings.comments.avatar, ...partial.settings?.comments?.avatar },
      },
      toc: { ...fallback.settings.toc, ...partial.settings?.toc },
      og: { ...fallback.settings.og, ...partial.settings?.og },
      footer: { ...fallback.settings.footer, ...partial.settings?.footer },
      mail: { ...fallback.settings.mail, ...partial.settings?.mail },
      cache: {
        og: { ...fallback.settings.cache.og, ...partial.settings?.cache?.og },
        calendar: { ...fallback.settings.cache.calendar, ...partial.settings?.cache?.calendar },
        avatar: { ...fallback.settings.cache.avatar, ...partial.settings?.cache?.avatar },
      },
    },
  }
}

async function loadSettingsFromDb(): Promise<BlogSettings> {
  try {
    const row = await findSettingByScope('blog')
    if (!row) return DEFAULT_SETTINGS
    return mergeWithDefaults(row.data)
  } catch (error) {
    log.error('Failed to read blog settings from DB; falling back to defaults', { error })
    return DEFAULT_SETTINGS
  }
}

/**
 * Eagerly hydrate the settings snapshot. Safe to call multiple times —
 * concurrent callers share the same in-flight promise. Resolves to the
 * merged `BlogSettings` for callers that want to await the fresh value.
 */
export function hydrateBlogSettings(): Promise<BlogSettings> {
  let pending = _getBlogSettingsHydration()
  if (!pending) {
    pending = loadSettingsFromDb().then((value) => {
      _setBlogSettingsSnapshot(value)
      return value
    })
    _setBlogSettingsHydration(pending)
  }
  return pending
}

/**
 * Force a re-read from the DB (used by the admin write endpoints after a
 * successful update so the next request sees the new values without
 * waiting for a cache window to expire).
 */
export async function refreshBlogSettings(): Promise<BlogSettings> {
  _setBlogSettingsHydration(undefined)
  return hydrateBlogSettings()
}

// Re-export the synchronous readers from the shared module so existing
// server-side callers (`@/server/seo/meta`, settings service, …) can
// keep importing from `@/server/settings/snapshot` without caring that
// the actual implementation lives in `@/shared/`.
export { getBlogConfigSync, getBlogSettingsSync }

// Kick off the initial hydration as soon as this module is first imported
// from a server bundle. The first request that lands before the promise
// resolves will see the defaults — which is the same shape the codebase
// has always shipped, so no consumer breaks. Subsequent requests see the
// live DB-backed values.
//
// Test runs (`VITEST=true`) skip the hydration so the suite isn't forced
// to mock the DB pool just to import a server module. Tests that need a
// non-default snapshot can call `setBlogSettingsSnapshotForTests(...)`.
if (typeof process === 'undefined' || process.env.VITEST !== 'true') {
  void hydrateBlogSettings().catch((error) => {
    log.error('Initial blog settings hydration failed', { error })
  })
}

/** Test-only: replace the snapshot synchronously. */
export function setBlogSettingsSnapshotForTests(value: BlogSettings | undefined): void {
  _setBlogSettingsSnapshot(value)
  _setBlogSettingsHydration(value === undefined ? undefined : Promise.resolve(value))
}
