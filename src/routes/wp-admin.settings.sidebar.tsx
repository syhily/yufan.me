import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { routeMeta } from '@/server/seo/meta'
import { SidebarForm } from '@/ui/admin/settings/SidebarForm'

export function meta() {
  return routeMeta({ title: '侧边栏' })
}

export default function WpAdminSettingsSidebarRoute() {
  const { settings, csrfToken } = useOutletContext<SettingsOutletContext>()
  return <SidebarForm settings={settings} csrfToken={csrfToken} />
}
