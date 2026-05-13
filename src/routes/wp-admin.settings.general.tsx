import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { requireAdmin } from '@/server/auth/rbac'
import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { getRouteRequestContext } from '@/server/session'
import { GeneralForm } from '@/ui/admin/settings/GeneralForm'

export const meta = settingsMeta('基本信息')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireAdmin(ctx)
  return null
}

export default function WpAdminSettingsGeneralRoute() {
  const { bundle, timeZones } = useOutletContext<SettingsOutletContext>()
  return <GeneralForm siteIdentity={bundle.siteIdentity} timeZones={timeZones} />
}
