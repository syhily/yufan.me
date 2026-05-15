import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { getRouteRequestContext } from '@/server/auth/context'
import { requireRole } from '@/server/auth/rbac'
import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { SeoForm } from '@/ui/admin/settings/SeoForm'

export const meta = settingsMeta('SEO 与目录')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export default function WpAdminSettingsSeoRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <SeoForm seo={bundle.seo} />
}
