import { Outlet, useOutletContext } from 'react-router'

import { getAdminBlogSettings } from '@/server/settings/service'
import { SettingsShell } from '@/ui/admin/settings/SettingsShell'

import type { Route } from './+types/wp-admin.settings.layout'

interface ParentContext {
  csrfToken: string
  currentUser: { id: string; name: string; email: string }
}

export interface SettingsOutletContext extends ParentContext {
  settings: Awaited<ReturnType<typeof getAdminBlogSettings>>['settings']
  constants: Awaited<ReturnType<typeof getAdminBlogSettings>>['constants']
}

// Single loader read shared by every section route below the shell. The
// snapshot is small (one JSONB row), so re-reading it once per navigation
// keeps the editor view fresh without each child route having to wire up
// its own fetcher. After a save, `useFetcher` posts to
// `admin/updateSettings` and React Router revalidates this loader, so the
// child gets the new snapshot for free.
export async function loader(_args: Route.LoaderArgs) {
  const { settings, constants } = await getAdminBlogSettings()
  return { settings, constants }
}

export default function WpAdminSettingsLayoutRoute({ loaderData }: Route.ComponentProps) {
  const parent = useOutletContext<ParentContext>()
  const context: SettingsOutletContext = {
    ...parent,
    settings: loaderData.settings,
    constants: loaderData.constants,
  }
  return (
    <SettingsShell>
      <Outlet context={context} />
    </SettingsShell>
  )
}
