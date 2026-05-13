import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { projectAssetsForAdmin } from '@/server/settings/projection'
import { AssetsForm } from '@/ui/admin/settings/AssetsForm'

export const meta = settingsMeta('存储配置')

export default function WpAdminSettingsAssetsRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <AssetsForm assets={projectAssetsForAdmin(bundle.assets)} />
}
