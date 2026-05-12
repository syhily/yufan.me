import { Outlet, useLocation, useOutletContext } from 'react-router'

import type { BlogSettingsBundle } from '@/shared/blog-config'

import { getAdminBlogSettings } from '@/server/settings/service'
import { getSupportedTimeZones } from '@/server/settings/timezones'
import { SettingsShell } from '@/ui/admin/settings/SettingsShell'

import type { Route } from './+types/wp-admin.settings.layout'

interface ParentContext {
  csrfToken: string
  currentUser: { id: string; name: string; email: string }
}

/**
 * Bundle shape downstream settings routes consume. Every section is
 * narrowed to NonNullable here because the loader below enforces the
 * invariant once and forwards the strengthened type to outlet
 * consumers. That deletes ~12 identical `bundle.<section> === null`
 * 503 guards from the per-section routes — the seed contract is now
 * checked exactly where it lives.
 */
export type SettingsBundle = {
  [K in keyof BlogSettingsBundle]-?: NonNullable<BlogSettingsBundle[K]>
}

export interface SettingsOutletContext extends ParentContext {
  /**
   * Bucketed settings document straight from the storage layer. Each
   * field maps 1:1 to a `setting('blog.<section>')` row, so a save to
   * one section never re-shapes another section's bucket. Per-section
   * forms read `bundle.footer`, `bundle.cache`, etc.
   *
   * Every bucket is non-null: the layout loader enforces the invariant
   * before it forwards the bundle to children.
   */
  bundle: SettingsBundle
  /**
   * Canonical IANA timezone list shared by every settings section that
   * renders a timezone picker (currently only the general form).
   * Resolved once at module load by `@/server/settings/timezones` so
   * we pay the `Intl.supportedValuesOf` cost once per process.
   */
  timeZones: readonly string[]
}

// Single loader read shared by every section route below the shell. The
// snapshot is small (one JSONB row per section), so re-reading it once
// per navigation keeps the editor view fresh without each child route
// having to wire up its own fetcher. After a save, `useFetcher` posts
// to `admin/updateSettings` and React Router revalidates this loader,
// so the child gets the new snapshot for free.
//
// Defensive 503 lives here ONCE: missing `siteIdentity` / `assets`
// rows mean the install never completed (the gate should have
// intercepted), and any other missing optional section means an admin
// truncated a row by hand. Surfacing the regression at the layer that
// actually owns the seed contract lets every per-section route trust
// the bundle is fully populated and avoid re-stating the same guard.
export async function loader(_args: Route.LoaderArgs) {
  const { bundle } = await getAdminBlogSettings()
  if (bundle === null) {
    throw new Response('Blog has not been installed yet.', { status: 503 })
  }
  const missing = Object.entries(bundle)
    .filter(([, value]) => value === null)
    .map(([key]) => key)
  if (missing.length > 0) {
    throw new Response(
      `Settings bundle is missing the following sections: ${missing.join(', ')}. ` +
        'The install flow should seed every section row up front, so this usually ' +
        'means a row was manually truncated. Re-run install or restore from backup.',
      { status: 503 },
    )
  }
  return {
    bundle: bundle as SettingsBundle,
    timeZones: getSupportedTimeZones(),
  }
}

export default function WpAdminSettingsLayoutRoute({ loaderData }: Route.ComponentProps) {
  const parent = useOutletContext<ParentContext>()
  const { pathname } = useLocation()
  const context: SettingsOutletContext = {
    ...parent,
    bundle: loaderData.bundle,
    timeZones: loaderData.timeZones,
  }
  return (
    <SettingsShell pathname={pathname}>
      <Outlet context={context} />
    </SettingsShell>
  )
}
