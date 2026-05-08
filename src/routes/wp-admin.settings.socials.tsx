import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { requireRole } from '@/server/auth/rbac'
import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { getRouteRequestContext } from '@/server/session'
import { SocialsEditor } from '@/ui/admin/settings/SocialsEditor'

export const meta = settingsMeta('社交链接')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export default function WpAdminSettingsSocialsRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <SocialsEditor socials={bundle.socials} />
}
