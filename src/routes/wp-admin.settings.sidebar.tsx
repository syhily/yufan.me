import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { requireAdmin } from '@/server/auth/rbac'
import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { getRouteRequestContext } from '@/server/session'
import { SidebarForm } from '@/ui/admin/settings/SidebarForm'

export const meta = settingsMeta('侧边栏')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireAdmin(ctx)
  return null
}

export default function WpAdminSettingsSidebarRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <SidebarForm sidebar={bundle.sidebar} />
}
