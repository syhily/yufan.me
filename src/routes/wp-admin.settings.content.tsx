import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { routeMeta } from '@/server/seo/meta'
import { ContentForm } from '@/ui/admin/settings/ContentForm'

export function meta() {
  return routeMeta({ title: '内容与分页' })
}

export default function WpAdminSettingsContentRoute() {
  const { settings, csrfToken } = useOutletContext<SettingsOutletContext>()
  return <ContentForm settings={settings} csrfToken={csrfToken} />
}
