import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { SocialsEditor } from '@/ui/admin/settings/SocialsEditor'

export const meta = settingsMeta('社交链接')

export default function WpAdminSettingsSocialsRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <SocialsEditor socials={bundle.socials} />
}
