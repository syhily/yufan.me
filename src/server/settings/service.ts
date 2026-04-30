import { findSettingByScope, upsertSetting } from '@/server/db/query/setting'
import { ActionFailure } from '@/server/route-helpers/api-handler'
import { type BlogSettings, BLOG_CONSTANTS, DEFAULT_SETTINGS } from '@/server/settings/defaults'
import { SECTION_SCHEMAS, type SettingsSection } from '@/server/settings/schema'
import { hydrateBlogSettings, refreshBlogSettings } from '@/server/settings/snapshot'

const SCOPE = 'blog'

// DTO returned by the admin "get settings" endpoint. Editors see the
// merged snapshot plus a `constants` block describing the bucket-A
// fields that remain code-side (read-only display only).
export interface AdminBlogSettingsDto {
  settings: BlogSettings
  constants: typeof BLOG_CONSTANTS
}

export async function getAdminBlogSettings(): Promise<AdminBlogSettingsDto> {
  // Always re-hydrate when the admin panel loads so the editor sees the
  // latest committed state, even if another tab just wrote to the row.
  const settings = await hydrateBlogSettings()
  return { settings, constants: BLOG_CONSTANTS }
}

// Apply a section-scoped patch to the stored JSON document. Each section
// fully replaces its own slice (no nested merge inside a section) so the
// admin form behaves predictably: whatever the user submits IS the new
// value for that section.
export async function updateBlogSettingsSection<S extends SettingsSection>(
  section: S,
  payload: unknown,
  updatedBy: bigint | null,
): Promise<BlogSettings> {
  const schema = SECTION_SCHEMAS[section]
  const parsed = await schema.safeParseAsync(payload)
  if (!parsed.success) {
    throw new ActionFailure(
      400,
      '设置数据无效',
      parsed.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.map(String),
      })),
    )
  }
  const validated = parsed.data as Record<string, unknown>

  const existing = await findSettingByScope(SCOPE)
  const existingData = (existing?.data as Record<string, unknown> | undefined) ?? {}

  const nextDocument = applySectionPatch(existingData, section, validated)
  await upsertSetting(nextDocument, updatedBy, SCOPE)

  return refreshBlogSettings()
}

// Drop the stored override for a section so the next read falls back to
// `DEFAULT_SETTINGS`. The DB document is rewritten without that section's
// keys; deleting the entire row would also reset every other section.
export async function resetBlogSettingsSection(
  section: SettingsSection,
  updatedBy: bigint | null,
): Promise<BlogSettings> {
  const existing = await findSettingByScope(SCOPE)
  const existingData = (existing?.data as Record<string, unknown> | undefined) ?? {}

  const nextDocument = removeSectionPatch(existingData, section)
  await upsertSetting(nextDocument, updatedBy, SCOPE)

  return refreshBlogSettings()
}

// --- Internal helpers ------------------------------------------------------

// Map a section to the top-level keys it owns inside the stored document.
// Sections that hold a single nested object (e.g. `sidebar`, `comments`,
// `footer`) overwrite the nested key wholesale; sections that own multiple
// top-level keys (e.g. `general` → title/description/…) get exploded.
function applySectionPatch(
  existing: Record<string, unknown>,
  section: SettingsSection,
  validated: Record<string, unknown>,
): Record<string, unknown> {
  switch (section) {
    case 'general':
      return {
        ...existing,
        title: validated.title,
        description: validated.description,
        website: validated.website,
        keywords: validated.keywords,
        author: validated.author,
      }
    case 'navigation':
      return { ...existing, navigation: validated.navigation }
    case 'socials':
      return { ...existing, socials: validated.socials }
    case 'content': {
      const nested = (existing.settings as Record<string, unknown> | undefined) ?? {}
      return {
        ...existing,
        settings: {
          ...nested,
          pagination: validated.pagination,
          feed: validated.feed,
          post: validated.post,
        },
      }
    }
    case 'sidebar': {
      const nested = (existing.settings as Record<string, unknown> | undefined) ?? {}
      return { ...existing, settings: { ...nested, sidebar: validated.sidebar } }
    }
    case 'comments': {
      const nested = (existing.settings as Record<string, unknown> | undefined) ?? {}
      return { ...existing, settings: { ...nested, comments: validated.comments } }
    }
    case 'seo': {
      const nested = (existing.settings as Record<string, unknown> | undefined) ?? {}
      return {
        ...existing,
        settings: { ...nested, twitter: validated.twitter, toc: validated.toc, og: validated.og },
      }
    }
    case 'footer': {
      const nested = (existing.settings as Record<string, unknown> | undefined) ?? {}
      return { ...existing, settings: { ...nested, footer: validated.footer } }
    }
    case 'mail': {
      const nested = (existing.settings as Record<string, unknown> | undefined) ?? {}
      // Preserve the existing API key when the editor omits the field:
      // the admin form sends `apiKey: undefined` whenever the input is
      // left blank, which means "I'm tweaking other fields, don't make
      // me re-paste the secret". Only an explicit string value (even
      // empty) intentionally overwrites the stored key.
      const incomingMail = (validated.mail as Record<string, unknown>) ?? {}
      const existingMail = (nested.mail as Record<string, unknown> | undefined) ?? {}
      const nextMail: Record<string, unknown> = { ...incomingMail }
      if (!('apiKey' in incomingMail) || incomingMail.apiKey === undefined) {
        nextMail.apiKey = existingMail.apiKey ?? ''
      }
      return { ...existing, settings: { ...nested, mail: nextMail } }
    }
    case 'cache': {
      const nested = (existing.settings as Record<string, unknown> | undefined) ?? {}
      return { ...existing, settings: { ...nested, cache: validated.cache } }
    }
  }
}

function removeSectionPatch(existing: Record<string, unknown>, section: SettingsSection): Record<string, unknown> {
  const next = { ...existing }
  const settingsBlock = { ...(existing.settings as Record<string, unknown> | undefined) }
  switch (section) {
    case 'general':
      delete next.title
      delete next.description
      delete next.website
      delete next.keywords
      delete next.author
      break
    case 'navigation':
      delete next.navigation
      break
    case 'socials':
      delete next.socials
      break
    case 'content':
      delete settingsBlock.pagination
      delete settingsBlock.feed
      delete settingsBlock.post
      next.settings = settingsBlock
      break
    case 'sidebar':
      delete settingsBlock.sidebar
      next.settings = settingsBlock
      break
    case 'comments':
      delete settingsBlock.comments
      next.settings = settingsBlock
      break
    case 'seo':
      delete settingsBlock.twitter
      delete settingsBlock.toc
      delete settingsBlock.og
      next.settings = settingsBlock
      break
    case 'footer':
      delete settingsBlock.footer
      next.settings = settingsBlock
      break
    case 'mail':
      delete settingsBlock.mail
      next.settings = settingsBlock
      break
    case 'cache':
      delete settingsBlock.cache
      next.settings = settingsBlock
      break
  }
  return next
}

// Re-export the defaults for callers (mostly tests) that need the seed.
export { DEFAULT_SETTINGS }
