import type { LoaderFunctionArgs } from 'react-router'

import { redirect } from 'react-router'

import { requireAdmin } from '@/server/auth/rbac'
import { getRouteRequestContext } from '@/server/session'

// `/wp-admin/settings` is the parent slot of the settings section; the
// `general` page owns the chrome the user sees first. Mirrors the
// `wp-admin.dashboard.tsx` → `wp-admin/comments` redirect pattern.
export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireAdmin(ctx)
  throw redirect('/wp-admin/settings/general')
}

export default function WpAdminSettingsIndex() {
  return null
}
