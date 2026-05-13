import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { requireAdmin } from '@/server/auth/rbac'
import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { getRouteRequestContext } from '@/server/session'
import { projectAssetsForAdmin } from '@/server/settings/projection'
import { AssetsForm } from '@/ui/admin/settings/AssetsForm'

export const meta = settingsMeta('存储配置')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireAdmin(ctx)
  return null
}

export default function WpAdminSettingsAssetsRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <AssetsForm assets={projectAssetsForAdmin(bundle.assets)} />
}
