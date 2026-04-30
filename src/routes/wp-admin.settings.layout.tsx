import { Outlet, useOutletContext } from 'react-router'

import type { BlogSettings } from '@/shared/blog-config'

import { getAdminBlogSettings } from '@/server/settings/service'
import { getSupportedTimeZones } from '@/server/settings/timezones'
import { SettingsShell } from '@/ui/admin/settings/SettingsShell'

import type { Route } from './+types/wp-admin.settings.layout'

interface ParentContext {
  csrfToken: string
  currentUser: { id: string; name: string; email: string }
}

export interface SettingsOutletContext extends ParentContext {
  /**
   * Always non-null inside the admin shell — the global install gate
   * has already redirected uninstalled deployments to
   * `/wp-admin/install.php`, so child routes can trust the snapshot
   * exists by the time they render.
   */
  settings: BlogSettings
  /**
   * Canonical IANA timezone list shared by every settings section that
   * renders a timezone picker (currently only the localization form).
   * Resolved once at module load by `@/server/settings/timezones` so
   * we pay the `Intl.supportedValuesOf` cost once per process.
   */
  timeZones: readonly string[]
}

// Single loader read shared by every section route below the shell. The
// snapshot is small (one JSONB row), so re-reading it once per navigation
// keeps the editor view fresh without each child route having to wire up
// its own fetcher. After a save, `useFetcher` posts to
// `admin/updateSettings` and React Router revalidates this loader, so the
// child gets the new snapshot for free.
export async function loader(_args: Route.LoaderArgs) {
  const { settings } = await getAdminBlogSettings()
  if (settings === null) {
    // The install gate should already have redirected to
    // `/wp-admin/install.php` long before reaching this loader; throwing
    // here is a defensive belt-and-braces that surfaces the regression
    // immediately instead of rendering a half-broken settings shell.
    throw new Response('Blog has not been installed yet.', { status: 503 })
  }
  return { settings, timeZones: getSupportedTimeZones() }
}

export default function WpAdminSettingsLayoutRoute({ loaderData }: Route.ComponentProps) {
  const parent = useOutletContext<ParentContext>()
  const context: SettingsOutletContext = {
    ...parent,
    settings: loaderData.settings,
    timeZones: loaderData.timeZones,
  }
  return (
    <SettingsShell>
      <Outlet context={context} />
    </SettingsShell>
  )
}
