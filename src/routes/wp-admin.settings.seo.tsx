import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { requireAdmin } from '@/server/auth/rbac'
import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { getRouteRequestContext } from '@/server/session'
import { SeoForm } from '@/ui/admin/settings/SeoForm'

export const meta = settingsMeta('SEO 与目录')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireAdmin(ctx)
  return null
}

export default function WpAdminSettingsSeoRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <SeoForm seo={bundle.seo} />
}
