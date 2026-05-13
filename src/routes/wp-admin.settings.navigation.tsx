import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { requireAdmin } from '@/server/auth/rbac'
import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { getRouteRequestContext } from '@/server/session'
import { NavigationEditor } from '@/ui/admin/settings/NavigationEditor'

export const meta = settingsMeta('导航菜单')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireAdmin(ctx)
  return null
}

export default function WpAdminSettingsNavigationRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <NavigationEditor navigation={bundle.navigation} />
}
