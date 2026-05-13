import { isRouteErrorResponse, Outlet, useLocation, useOutletContext, useRouteError } from 'react-router'

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
export async function loader({ request, context }: Route.LoaderArgs) {
  const { role } = await import('@/server/session').then((m) => m.getRouteRequestContext({ request, context }))
  if (role !== 'admin') throw await import('react-router').then((m) => m.redirect('/wp-admin/welcome'))
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

// Render section errors inside the SettingsShell so the admin chrome
// (sidebar nav, breadcrumb) survives. Without this, a 500 from a
// per-section loader bubbles to `wp-admin.layout`'s ErrorBoundary which
// renders a bare error page and the operator loses their context.
export function ErrorBoundary() {
  const error = useRouteError()
  const { pathname } = useLocation()
  const title = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : '设置加载失败'
  const message = isRouteErrorResponse(error)
    ? typeof error.data === 'string'
      ? error.data
      : error.statusText
    : error instanceof Error
      ? error.message
      : '未知错误'

  return (
    <SettingsShell pathname={pathname}>
      <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="text-lg font-semibold text-destructive">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </SettingsShell>
  )
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
