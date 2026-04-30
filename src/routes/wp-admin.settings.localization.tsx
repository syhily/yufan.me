import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { routeMeta } from '@/server/seo/meta'
import { LocalizationForm } from '@/ui/admin/settings/LocalizationForm'

export function meta() {
  return routeMeta({ title: '资源与本地化' })
}

export default function WpAdminSettingsLocalizationRoute() {
  const { settings, csrfToken, timeZones } = useOutletContext<SettingsOutletContext>()
  return <LocalizationForm settings={settings} csrfToken={csrfToken} timeZones={timeZones} />
}
