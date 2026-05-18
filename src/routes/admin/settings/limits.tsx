import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/admin/settings/layout'

import { getRouteRequestContext } from '@/server/domains/auth/context'
import { requireRole } from '@/server/domains/auth/rbac'
import { settingsMeta } from '@/server/render/seo/settings-meta'
import { LimitsForm } from '@/ui/admin/settings/LimitsForm'

export const meta = settingsMeta('运行限制')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export default function AdminSettingsLimitsRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <LimitsForm limits={bundle.limits} />
}
