import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { ContentForm } from '@/ui/admin/settings/ContentForm'

export const meta = settingsMeta('内容与分页')

export default function WpAdminSettingsContentRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <ContentForm content={bundle.content} />
}
