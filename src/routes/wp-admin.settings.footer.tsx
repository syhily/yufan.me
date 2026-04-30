import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { routeMeta } from '@/server/seo/meta'
import { FooterForm } from '@/ui/admin/settings/FooterForm'

export function meta() {
  return routeMeta({ title: '页脚' })
}

export default function WpAdminSettingsFooterRoute() {
  const { settings, csrfToken } = useOutletContext<SettingsOutletContext>()
  return <FooterForm settings={settings} csrfToken={csrfToken} />
}
