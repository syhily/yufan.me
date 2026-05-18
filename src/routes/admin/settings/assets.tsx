import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/admin/settings/layout'

import { getRouteRequestContext } from '@/server/domains/auth/context'
import { requireRole } from '@/server/domains/auth/rbac'
import { projectAssetsForAdmin } from '@/server/domains/settings/projection'
import { settingsMeta } from '@/server/render/seo/settings-meta'
import { AssetsForm } from '@/ui/admin/settings/AssetsForm'

export const meta = settingsMeta('存储配置')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export default function WpAdminSettingsAssetsRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <AssetsForm assets={projectAssetsForAdmin(bundle.assets)} />
}
