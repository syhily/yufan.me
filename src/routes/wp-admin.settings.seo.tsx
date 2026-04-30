import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { routeMeta } from '@/server/seo/meta'
import { SeoForm } from '@/ui/admin/settings/SeoForm'

export function meta() {
  return routeMeta({ title: 'SEO 与目录' })
}

export default function WpAdminSettingsSeoRoute() {
  const { settings, constants, csrfToken } = useOutletContext<SettingsOutletContext>()
  return <SeoForm settings={settings} constants={constants} csrfToken={csrfToken} />
}
