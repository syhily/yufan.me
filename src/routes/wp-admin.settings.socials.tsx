import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { routeMeta } from '@/server/seo/meta'
import { SocialsEditor } from '@/ui/admin/settings/SocialsEditor'

export function meta() {
  return routeMeta({ title: '社交链接' })
}

export default function WpAdminSettingsSocialsRoute() {
  const { settings, csrfToken } = useOutletContext<SettingsOutletContext>()
  return <SocialsEditor settings={settings} csrfToken={csrfToken} />
}
