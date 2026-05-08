import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { SidebarForm } from '@/ui/admin/settings/SidebarForm'

import type { Route } from './+types/wp-admin.settings.sidebar'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '侧边栏' }, bundleFromMatches(matches))
}

export default function WpAdminSettingsSidebarRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <SidebarForm sidebar={bundle.sidebar} />
}
