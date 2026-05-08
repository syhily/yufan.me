import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { getRouteRequestContext } from '@/server/auth/context'
import { requireRole } from '@/server/auth/rbac'
import { settingsMeta } from '@/server/present/seo/settings-meta'
import { RateLimitForm } from '@/ui/admin/settings/RateLimitForm'

export const meta = settingsMeta('流控设置')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export default function WpAdminSettingsRateLimitRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <RateLimitForm rateLimit={bundle.rateLimit} />
}
