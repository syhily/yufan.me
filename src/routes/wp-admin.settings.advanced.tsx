import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { routeMeta } from '@/server/seo/meta'
import { AdvancedView } from '@/ui/admin/settings/AdvancedView'

export function meta() {
  return routeMeta({ title: '高级（只读）' })
}

export default function WpAdminSettingsAdvancedRoute() {
  const { constants } = useOutletContext<SettingsOutletContext>()
  return <AdvancedView constants={constants} />
}
