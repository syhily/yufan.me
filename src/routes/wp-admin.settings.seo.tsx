import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { SeoForm } from '@/ui/admin/settings/SeoForm'

export const meta = settingsMeta('SEO 与目录')

export default function WpAdminSettingsSeoRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <SeoForm seo={bundle.seo} />
}
