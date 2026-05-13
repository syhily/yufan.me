import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { SidebarForm } from '@/ui/admin/settings/SidebarForm'

export const meta = settingsMeta('侧边栏')

export default function WpAdminSettingsSidebarRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <SidebarForm sidebar={bundle.sidebar} />
}
