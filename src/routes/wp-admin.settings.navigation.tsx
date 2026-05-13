import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { NavigationEditor } from '@/ui/admin/settings/NavigationEditor'

export const meta = settingsMeta('导航菜单')

export default function WpAdminSettingsNavigationRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <NavigationEditor navigation={bundle.navigation} />
}
