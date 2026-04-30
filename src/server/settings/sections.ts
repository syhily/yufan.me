import { z } from 'zod'

import type { BlogSettingsBundle } from '@/shared/blog-config'

import {
  cacheSchema,
  commentsSchema,
  contentSchema,
  footerSchema,
  generalSchema,
  localizationSchema,
  mailSchema,
  navigationSchema,
  seoSchema,
  sidebarSchema,
  socialsSchema,
} from '@/server/settings/schema'

// Section registry. Single source of truth for every settings section
// and its four relationships:
//
//   1. `scope`    — the `setting.scope` row that holds this section.
//   2. `schema`   — the Zod validator the admin update endpoint uses.
//   3. `key`      — the bundle field this section maps to in
//                   `BlogSettingsBundle` (also the React-context name on
//                   the UI side).
//   4. `defaults` — the seed payload the install flow writes when the
//                   section has no admin-provided values. `null` means
//                   the section requires user input (general,
//                   localization) and the install flow's stage-2 form
//                   supplies the row contents directly. Every other
//                   section ships with a sensible starter document so
//                   the very first request after install can render
//                   without throwing from the strict per-section hooks
//                   (`useFooterSettings()`, `useNavigationSettings()`,
//                   …) before the admin has visited each settings tab.
//
// `service.ts`, `snapshot.ts`, and the install seed all import this
// registry instead of hard-coding the scope strings, so renaming a
// section (or adding a 12th) is a one-line change here.

export interface SectionMeta<
  S extends z.ZodType = z.ZodType,
  K extends keyof BlogSettingsBundle = keyof BlogSettingsBundle,
> {
  /** DB scope key, e.g. `blog.general`. */
  scope: string
  /** Zod schema validating the inbound admin payload. */
  schema: S
  /** Bundle field this section populates on the in-memory snapshot. */
  key: K
  /**
   * Install-time seed payload. `null` means the section requires user
   * input (the install form provides it). A non-null value MUST already
   * satisfy `schema` — see the install seed's `safeParse` defence in
   * depth and the `service.settings — sections.defaults` test.
   */
  defaults: Record<string, unknown> | null
}

// Sensible-default seed payloads for the 9 optional sections. Each
// payload is shaped to satisfy its section's Zod schema verbatim so the
// install flow can write it through `upsertSetting` without any extra
// massaging. Keep these values conservative — empty arrays / disabled
// integrations / 1-day TTLs — so a fresh deployment looks "off" until
// the admin opts into each surface from the matching `/wp-admin/
// settings/<section>` page.
const navigationDefaults = { navigation: [] } as const
const socialsDefaults = { socials: [] } as const
const contentDefaults = {
  pagination: { posts: 10, category: 10, tags: 10, search: 10 },
  feed: { full: false, size: 20 },
  post: { sort: 'desc' as const },
} as const
const sidebarDefaults = {
  sidebar: { calendar: false, search: true, comment: 5, post: 5, tag: 20 },
} as const
const commentsDefaults = {
  comments: {
    size: 10,
    // Gravatar's HTTPS endpoint is the historical default mirror; the
    // admin can swap in a regional mirror (e.g. `gravatar.loli.net`)
    // from `/wp-admin/settings/comments` without dropping a row.
    avatar: { mirror: 'https://www.gravatar.com/avatar', size: 80 },
  },
} as const
const seoDefaults = {
  twitter: '',
  toc: { minHeadingLevel: 2, maxHeadingLevel: 4 },
  og: { width: 1200, height: 630 },
} as const
// `initialYear` is bound to the install-time current year so the
// footer's "© 2024-2026" range starts from a sensible baseline. The
// admin can backdate it from `/wp-admin/settings/footer` if the site's
// real first-publish year is earlier.
//
// Stored as a stable object literal computed at module load time. The
// process restarts on each deploy so the year stays current; tests
// that need a fixed year freeze `Date` themselves before importing.
const footerDefaults = {
  footer: { initialYear: new Date().getUTCFullYear() },
} as const
const mailDefaults = {
  // Disabled by default — the sender must supply a Zeabur ZSend host +
  // API key + verified sender address before any outgoing mail flows.
  // `host`/`sender` carry placeholders so the schema's `min(1)` and
  // `email` constraints pass: an empty `mail.host` would reject the
  // seed. The admin form treats both fields as freely editable.
  mail: { enabled: false, host: 'api.zeabur.com', apiKey: '', sender: 'noreply@example.com' },
} as const
// `:`-suffixed prefixes are the safe shape: the cache schema rejects
// any prefix that's a strict prefix of (or equal to) another bucket's
// prefix, AND any prefix that collides with the reserved `session:` /
// `rate-limit:` / `avatar-status-` surfaces. `og:`, `calendar:`, and
// `avatar:` clear both bars without overlapping each other.
const cacheDefaults = {
  cache: {
    og: { prefix: 'og:', ttlSeconds: 60 * 60 * 24 },
    calendar: { prefix: 'calendar:', ttlSeconds: 60 * 60 * 24 },
    avatar: { prefix: 'avatar:', ttlSeconds: 60 * 60 * 24 },
  },
} as const

export const SECTION_REGISTRY = {
  general: { scope: 'blog.general', schema: generalSchema, key: 'siteIdentity', defaults: null },
  localization: { scope: 'blog.localization', schema: localizationSchema, key: 'localization', defaults: null },
  navigation: { scope: 'blog.navigation', schema: navigationSchema, key: 'navigation', defaults: navigationDefaults },
  socials: { scope: 'blog.socials', schema: socialsSchema, key: 'socials', defaults: socialsDefaults },
  content: { scope: 'blog.content', schema: contentSchema, key: 'content', defaults: contentDefaults },
  sidebar: { scope: 'blog.sidebar', schema: sidebarSchema, key: 'sidebar', defaults: sidebarDefaults },
  comments: { scope: 'blog.comments', schema: commentsSchema, key: 'comments', defaults: commentsDefaults },
  seo: { scope: 'blog.seo', schema: seoSchema, key: 'seo', defaults: seoDefaults },
  footer: { scope: 'blog.footer', schema: footerSchema, key: 'footer', defaults: footerDefaults },
  mail: { scope: 'blog.mail', schema: mailSchema, key: 'mail', defaults: mailDefaults },
  cache: { scope: 'blog.cache', schema: cacheSchema, key: 'cache', defaults: cacheDefaults },
} as const satisfies Record<string, SectionMeta>

export type SettingsSection = keyof typeof SECTION_REGISTRY

export const SETTINGS_SECTIONS = Object.keys(SECTION_REGISTRY) as readonly SettingsSection[]

/** Common prefix used to fetch every settings row in one SELECT. */
export const SETTINGS_SCOPE_PREFIX = 'blog.'

/**
 * Reverse lookup: given a `scope` string from the DB, return the
 * matching section id (or `null` if the row belongs to some other
 * surface we don't recognise — defensive against stale rows).
 */
export function sectionFromScope(scope: string): SettingsSection | null {
  for (const section of SETTINGS_SECTIONS) {
    if (SECTION_REGISTRY[section].scope === scope) return section
  }
  return null
}

// Wire envelope used by the admin `updateSettings` PATCH endpoint.
// Defined here (not in `schema.ts`) so it can `z.enum(SETTINGS_SECTIONS)`
// off the registry without creating a `schema.ts` ↔ `sections.ts`
// circular import.
export const updateSettingsSchema = z.object({
  section: z.enum(SETTINGS_SECTIONS as [SettingsSection, ...SettingsSection[]]),
  payload: z.unknown(),
})
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>

/**
 * Validate every section's `defaults` payload against its own
 * `schema`, returning the list of `(section, parsed-payload)` pairs
 * for sections that ship with a non-null seed. Throws
 * `Error('blog.<section> defaults invalid')` when any default fails
 * its schema — that's a programmer bug in this file, not a runtime
 * data error, so loud failure is the right behaviour.
 *
 * Used by:
 *   - `seedInstallSettingsWithSession()` (first-time install).
 *   - `backfillMissingSectionDefaults()` (existing deployments that
 *     pre-date the "seed all sections at install" change).
 */
export function buildDefaultSectionPayloads(): { section: SettingsSection; payload: Record<string, unknown> }[] {
  const out: { section: SettingsSection; payload: Record<string, unknown> }[] = []
  for (const section of SETTINGS_SECTIONS) {
    const meta = SECTION_REGISTRY[section]
    if (meta.defaults === null) continue
    const check = meta.schema.safeParse(meta.defaults)
    if (!check.success) {
      // Surface the first issue path in the message so a regression
      // pinpoints the exact field that drifted.
      const first = check.error.issues[0]
      const path = first ? first.path.join('.') : '<unknown>'
      throw new Error(`${meta.scope} defaults invalid at \`${path}\`: ${first?.message ?? 'unknown reason'}`)
    }
    out.push({ section, payload: check.data as Record<string, unknown> })
  }
  return out
}
