import type { BlogSettings, BlogSettingsBundle } from '@/shared/blog-config'

import { findSettingByScope, upsertSetting } from '@/server/db/query/setting'
import { ActionFailure } from '@/server/route-helpers/api-handler'
import { SECTION_REGISTRY, type SettingsSection } from '@/server/settings/sections'
import { hydrateBlogSettings, refreshBlogSettings } from '@/server/settings/snapshot'
import { bundleToBlogSettings } from '@/shared/blog-config'

// DTO returned by the admin "get settings" endpoint. The codebase no
// longer ships a `BlogConstants` block — every previously-static field
// (`asset`, `locale`, `timeZone`, `timeFormat`) is editable via the
// localization section. The DTO can be `null` only on a deployment that
// has not been installed yet, but in practice the install gate already
// redirected the request away from the admin shell, so callers may
// safely treat `null` as a programmer error.
//
// The on-disk shape is now bucketed (`BlogSettingsBundle`) but the
// admin layout and its 11 child routes still consume the legacy
// aggregated `BlogSettings` view so we can ship the storage refactor
// without touching every form. The bundle is exposed alongside it for
// consumers that want to read individual sections directly.
export interface AdminBlogSettingsDto {
  settings: BlogSettings | null
  bundle: BlogSettingsBundle | null
}

export async function getAdminBlogSettings(): Promise<AdminBlogSettingsDto> {
  // Always re-hydrate when the admin panel loads so the editor sees the
  // latest committed state, even if another tab just wrote to the row.
  const bundle = await hydrateBlogSettings()
  return { settings: bundleToBlogSettings(bundle), bundle }
}

// Apply a section-scoped patch by writing ONLY the row that owns the
// section. Each section has its own `setting('blog.<section>')` row, so
// concurrent edits to different sections never read, merge, or
// overwrite each other's JSONB. The on-disk row is the validated
// payload verbatim — no nested merge with the rest of the document.
export async function updateBlogSettingsSection<S extends SettingsSection>(
  section: S,
  payload: unknown,
  updatedBy: bigint | null,
): Promise<BlogSettings | null> {
  const meta = SECTION_REGISTRY[section]
  const parsed = await meta.schema.safeParseAsync(payload)
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

  const nextRow = await applySectionPatch(section, validated)
  await upsertSetting(nextRow, updatedBy, meta.scope)

  const bundle = await refreshBlogSettings()
  return bundleToBlogSettings(bundle)
}

// --- Internal helpers ------------------------------------------------------

// Build the row's `data` payload for the given section. Most sections
// just return the validated payload verbatim; the `mail` section folds
// in the existing API key when the editor omits it (see comment below).
async function applySectionPatch(
  section: SettingsSection,
  validated: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (section !== 'mail') return validated

  // Preserve the existing API key when the editor omits the field:
  // the admin form sends `apiKey: undefined` whenever the input is
  // left blank, which means "I'm tweaking other fields, don't make
  // me re-paste the secret". Only an explicit string value (even
  // empty) intentionally overwrites the stored key. The conflict
  // domain is the `blog.mail` row only — a concurrent edit to
  // `blog.cache` cannot wipe the API key.
  const incomingMail = (validated.mail as Record<string, unknown>) ?? {}
  if ('apiKey' in incomingMail && incomingMail.apiKey !== undefined) {
    return validated
  }

  const existingRow = await findSettingByScope(SECTION_REGISTRY.mail.scope)
  const existingMail = (existingRow?.data as Record<string, unknown> | undefined)?.mail as
    | Record<string, unknown>
    | undefined
  const nextMail: Record<string, unknown> = { ...incomingMail, apiKey: existingMail?.apiKey ?? '' }
  return { mail: nextMail }
}
