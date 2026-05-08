import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { NavigationEditor } from '@/ui/admin/settings/NavigationEditor'

import type { Route } from './+types/wp-admin.settings.navigation'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '导航菜单' }, bundleFromMatches(matches))
}

export default function WpAdminSettingsNavigationRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <NavigationEditor navigation={bundle.navigation} />
}
