import type { LoaderFunctionArgs } from 'react-router'

import { redirect } from 'react-router'

import { getRouteRequestContext } from '@/server/domains/auth/context'
import { requireRole } from '@/server/domains/auth/rbac'

// `/wp-admin/settings` is the parent slot of the settings section; the
// `general` page owns the chrome the user sees first. Mirrors the
// `wp-admin.dashboard.tsx` → `wp-admin/welcome` redirect pattern.
export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  throw redirect('/wp-admin/settings/general')
}

export default function WpAdminSettingsIndex() {
  return null
}
