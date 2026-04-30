import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { routeMeta } from '@/server/seo/meta'
import { NavigationEditor } from '@/ui/admin/settings/NavigationEditor'

export function meta() {
  return routeMeta({ title: '导航菜单' })
}

export default function WpAdminSettingsNavigationRoute() {
  const { settings, csrfToken } = useOutletContext<SettingsOutletContext>()
  return <NavigationEditor settings={settings} csrfToken={csrfToken} />
}
