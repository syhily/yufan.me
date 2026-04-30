import type { BlogSettings, BlogSettingsBundle } from '@/shared/blog-config'

import { findSettingsByScopePrefix, upsertSetting } from '@/server/db/query/setting'
import { getLogger } from '@/server/logger'
import {
  buildDefaultSectionPayloads,
  SECTION_REGISTRY,
  SETTINGS_SCOPE_PREFIX,
  SETTINGS_SECTIONS,
  sectionFromScope,
  type SettingsSection,
} from '@/server/settings/sections'
import { blogSettingsToBundle } from '@/shared/blog-config'
import {
  _getBlogSettingsHydration,
  _setBlogSettingsHydration,
  _setBlogSettingsSnapshot,
  getBlogConfigSync,
  getBlogSettingsBundleSync,
  getBlogSettingsSync,
  requireBlogSettingsBundle,
} from '@/shared/blog-config-snapshot'

const log = getLogger('settings.snapshot')

// Server-only writer for the in-process blog settings snapshot. Owns
// the DB read, the lazy hydration on first access, and the explicit
// refresh fired by every admin write.
//
// The synchronous reader (`getBlogConfigSync()` / `getBlogSettingsSync()`
// / `getBlogSettingsBundleSync()`) lives in
// `@/shared/blog-config-snapshot` so it can be reached from route
// `meta()` exports — which run on the client too — without dragging
// Drizzle/Postgres into the browser bundle. Both halves share the same
// `globalThis`-backed snapshot slot, which now holds a
// `BlogSettingsBundle` (one bucket per section) instead of the legacy
// flat `BlogSettings`.
//
// There is no longer a deep-merge with defaults: the codebase has no
// `DEFAULT_SETTINGS` anymore. Either the install flow has written the
// `blog.general` + `blog.localization` rows (and consumers see the
// matching buckets), or the install gate redirects every non-install
// request to `/wp-admin/install.php` before any consumer reaches for
// the snapshot. Pre-install we therefore expose `null`, and
// `requireBlogConfig()` throws so any post-install path that bypasses
// the gate fails loudly.

// Per-section shape probes. Each probe returns `true` when the loaded
// JSONB row matches the bucket DTO it claims to populate; rows that
// fail the probe are silently dropped so a corrupt section can't take
// down sibling sections that loaded fine.
type SectionProbe = (value: Record<string, unknown>) => boolean

const PROBES: Record<keyof typeof SECTION_REGISTRY, SectionProbe> = {
  general: (value) =>
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.website === 'string' &&
    Array.isArray(value.keywords) &&
    typeof value.author === 'object' &&
    value.author !== null,
  localization: (value) =>
    typeof value.asset === 'object' &&
    value.asset !== null &&
    typeof value.locale === 'string' &&
    typeof value.timeZone === 'string' &&
    typeof value.timeFormat === 'string',
  navigation: (value) => Array.isArray(value.navigation),
  socials: (value) => Array.isArray(value.socials),
  content: (value) =>
    typeof value.pagination === 'object' &&
    value.pagination !== null &&
    typeof value.feed === 'object' &&
    value.feed !== null &&
    typeof value.post === 'object' &&
    value.post !== null,
  sidebar: (value) => typeof value.sidebar === 'object' && value.sidebar !== null,
  comments: (value) => typeof value.comments === 'object' && value.comments !== null,
  seo: (value) =>
    typeof value.twitter === 'string' &&
    typeof value.toc === 'object' &&
    value.toc !== null &&
    typeof value.og === 'object' &&
    value.og !== null,
  footer: (value) => typeof value.footer === 'object' && value.footer !== null,
  mail: (value) => typeof value.mail === 'object' && value.mail !== null,
  cache: (value) => typeof value.cache === 'object' && value.cache !== null,
}

function emptyBundle(): BlogSettingsBundle {
  return {
    siteIdentity: null,
    localization: null,
    navigation: null,
    socials: null,
    content: null,
    sidebar: null,
    comments: null,
    seo: null,
    footer: null,
    mail: null,
    cache: null,
  }
}

async function loadSettingsFromDb(): Promise<BlogSettingsBundle | null> {
  // Intentionally NOT wrapped in a try/catch: DB errors must propagate
  // up to `hydrateBlogSettings()` so the failed promise can be evicted
  // from the cache. Otherwise a transient outage on the very first
  // hydration would permanently pin the snapshot at "uninstalled" and
  // deadlock every subsequent request behind the install redirect.
  const rows = await findSettingsByScopePrefix(SETTINGS_SCOPE_PREFIX)
  if (rows.length === 0) return null

  const bundle = emptyBundle()
  for (const row of rows) {
    const section = sectionFromScope(row.scope)
    if (section === null) {
      log.warn('Ignoring setting row with unrecognised scope', { scope: row.scope })
      continue
    }
    const data = row.data as Record<string, unknown> | null | undefined
    if (data === null || typeof data !== 'object') {
      log.warn('Setting row has non-object data; skipping', { scope: row.scope })
      continue
    }
    if (!PROBES[section](data)) {
      log.warn('Setting row failed shape probe; skipping', { scope: row.scope })
      continue
    }
    const meta = SECTION_REGISTRY[section]
    // The bucket field carries the same DTO shape as the row's `data`;
    // the cast is a deliberate boundary widening that the probe above
    // backs.
    ;(bundle as unknown as Record<string, unknown>)[meta.key] = data
  }

  // "Installed" semantics: at least the two stage-2 install rows
  // (`blog.general` + `blog.localization`) must be present. Until they
  // are, treat the deployment as uninstalled so the install gate keeps
  // redirecting to `/wp-admin/install.php`.
  if (bundle.siteIdentity === null || bundle.localization === null) {
    return null
  }

  // Backfill: a deployment installed BEFORE the "seed every section at
  // install" change exists in the wild with only the 2 install rows.
  // The strict per-section hooks (`useFooterSettings()`, …) would
  // throw on the very first public render. Detect missing optional
  // sections here, write the registry's default payload for each, and
  // fold the freshly-seeded data into the bundle so the SAME hydration
  // call returns a complete snapshot. New installs run through
  // `seedInstallSettingsWithSession()` which writes all 11 rows up
  // front, so they hit this branch with nothing to do.
  await backfillMissingSectionDefaults(bundle)

  return bundle
}

/**
 * Detect sections whose `defaults` is non-null but whose bundle
 * bucket is still `null` (i.e. the install pre-dates the "seed all
 * sections at install" change). For each such section, validate the
 * registry default, write it to the matching `setting('blog.<scope>')`
 * row, and populate the bucket so the caller observes the same
 * post-backfill snapshot the next request would.
 *
 * Mutates `bundle` in place. Logs and skips sections whose seed
 * default fails its own schema (programmer error in `sections.ts`)
 * or whose UPSERT fails (transient DB error — the next hydration
 * tick will retry). Crucially we DO NOT throw: a backfill failure
 * would otherwise propagate to `hydrateBlogSettings()` and deadlock
 * the entire site behind the install gate. The user-visible cost of a
 * skipped backfill is the original "no provider in scope" error on
 * the missing section, which is what we had before this change — no
 * regression.
 */
async function backfillMissingSectionDefaults(bundle: BlogSettingsBundle): Promise<void> {
  let candidates: { section: SettingsSection; payload: Record<string, unknown> }[]
  try {
    candidates = buildDefaultSectionPayloads()
  } catch (error) {
    log.error('Section defaults invalid; skipping backfill', { error })
    return
  }

  for (const { section, payload } of candidates) {
    const meta = SECTION_REGISTRY[section]
    // Skip sections whose row already exists. The bundle.<key> field
    // is `null` only when the SELECT above either didn't see a row or
    // saw one whose probe rejected the shape; both are safe to
    // overwrite with the validated default (probe-failed rows are
    // already being treated as missing by the snapshot reader).
    if ((bundle as unknown as Record<string, unknown>)[meta.key] !== null) continue

    try {
      await upsertSetting(payload, null, meta.scope)
      ;(bundle as unknown as Record<string, unknown>)[meta.key] = payload
      log.info('Backfilled missing section with registry default', { scope: meta.scope })
    } catch (error) {
      log.warn('Failed to backfill missing section default', { scope: meta.scope, error })
    }
  }
}

/**
 * Eagerly hydrate the settings snapshot. Safe to call multiple times —
 * concurrent callers share the same in-flight promise. Resolves to the
 * stored `BlogSettingsBundle` (or `null` when the deployment has not
 * been installed yet).
 *
 * If the underlying DB query throws (transient outage, pool drain, …)
 * the cached promise is cleared so the next caller can retry instead of
 * being permanently pinned at the failure.
 */
export function hydrateBlogSettings(): Promise<BlogSettingsBundle | null> {
  let pending = _getBlogSettingsHydration()
  if (!pending) {
    pending = loadSettingsFromDb()
      .then((value) => {
        _setBlogSettingsSnapshot(value)
        return value
      })
      .catch((error) => {
        // Evict the failed promise so a follow-up request retries.
        // We rethrow so the caller can decide what to do (the install
        // gate logs and lets the request through; the search warmup
        // logs and skips index construction).
        _setBlogSettingsHydration(undefined)
        throw error
      })
    _setBlogSettingsHydration(pending)
  }
  return pending
}

/**
 * Force a re-read from the DB (used by the install + admin write
 * endpoints after a successful update so the next request sees the new
 * values without waiting for a cache window to expire).
 */
export async function refreshBlogSettings(): Promise<BlogSettingsBundle | null> {
  _setBlogSettingsHydration(undefined)
  return hydrateBlogSettings()
}

// Re-export the synchronous readers from the shared module so existing
// server-side callers (`@/server/seo/meta`, settings service, …) can
// keep importing from `@/server/settings/snapshot` without caring that
// the actual implementation lives in `@/shared/`.
export { getBlogConfigSync, getBlogSettingsBundleSync, getBlogSettingsSync, requireBlogSettingsBundle }

// Kick off the initial hydration as soon as this module is first imported
// from a server bundle. The first request that lands before the promise
// resolves will see `null` from the synchronous reader — the install
// gate runs before any consumer reaches for the snapshot, so that case
// only happens during the install flow itself (which tolerates `null`).
//
// Test runs (`VITEST=true`) skip the hydration so the suite isn't forced
// to mock the DB pool just to import a server module. Tests that need a
// hydrated snapshot can call `setBlogSettingsBundleForTests(...)`.
if (typeof process === 'undefined' || process.env.VITEST !== 'true') {
  void hydrateBlogSettings().catch((error) => {
    log.error('Initial blog settings hydration failed', { error })
  })
}

/** Test-only: replace the snapshot synchronously. */
export function setBlogSettingsBundleForTests(value: BlogSettingsBundle | null | undefined): void {
  _setBlogSettingsSnapshot(value)
  _setBlogSettingsHydration(value === undefined ? undefined : Promise.resolve(value ?? null))
}

/**
 * Legacy test helper. Accepts the aggregated `BlogSettings` shape and
 * decomposes it into a bundle before populating the snapshot slot. Kept
 * so the existing test fixtures can keep spelling themselves in the old
 * shape without churning every `vi.mock` call site.
 */
export function setBlogSettingsSnapshotForTests(value: BlogSettings | null | undefined): void {
  if (value === undefined) {
    setBlogSettingsBundleForTests(undefined)
    return
  }
  if (value === null) {
    setBlogSettingsBundleForTests(null)
    return
  }
  setBlogSettingsBundleForTests(blogSettingsToBundle(value))
}

// `SETTINGS_SECTIONS` is exported for `service.ts` and tests that
// need to enumerate the registry.
export { SETTINGS_SECTIONS }
