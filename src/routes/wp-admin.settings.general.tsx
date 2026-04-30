import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { routeMeta } from '@/server/seo/meta'
import { GeneralForm } from '@/ui/admin/settings/GeneralForm'

export function meta() {
  return routeMeta({ title: '基本信息' })
}

export default function WpAdminSettingsGeneralRoute() {
  const { settings, csrfToken } = useOutletContext<SettingsOutletContext>()
  return <GeneralForm settings={settings} csrfToken={csrfToken} />
}
