import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/admin/settings/layout'

import { getRouteRequestContext } from '@/server/domains/auth/context'
import { requireRole } from '@/server/domains/auth/rbac'
import { settingsMeta } from '@/server/render/seo/settings-meta'
import { SidebarForm } from '@/ui/admin/settings/SidebarForm'

export const meta = settingsMeta('侧边栏')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export default function WpAdminSettingsSidebarRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <SidebarForm sidebar={bundle.sidebar} />
}
