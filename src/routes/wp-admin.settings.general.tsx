import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { getRouteRequestContext } from '@/server/auth/context'
import { requireRole } from '@/server/auth/rbac'
import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { GeneralForm } from '@/ui/admin/settings/GeneralForm'

export const meta = settingsMeta('基本信息')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export default function WpAdminSettingsGeneralRoute() {
  const { bundle, timeZones } = useOutletContext<SettingsOutletContext>()
  return <GeneralForm siteIdentity={bundle.siteIdentity} timeZones={timeZones} />
}
