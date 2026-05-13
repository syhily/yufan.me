import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { requireAdmin } from '@/server/auth/rbac'
import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { getRouteRequestContext } from '@/server/session'
import { RateLimitForm } from '@/ui/admin/settings/RateLimitForm'

export const meta = settingsMeta('流控设置')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireAdmin(ctx)
  return null
}

export default function WpAdminSettingsRateLimitRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <RateLimitForm rateLimit={bundle.rateLimit} />
}
