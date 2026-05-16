import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin/settings/layout'

import { getRouteRequestContext } from '@/server/domains/auth/context'
import { requireRole } from '@/server/domains/auth/rbac'
import { settingsMeta } from '@/server/render/seo/settings-meta'
import { NavigationEditor } from '@/ui/admin/settings/NavigationEditor'

export const meta = settingsMeta('导航菜单')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export default function WpAdminSettingsNavigationRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <NavigationEditor navigation={bundle.navigation} />
}
