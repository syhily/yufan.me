import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { requireAdmin } from '@/server/auth/rbac'
import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { getRouteRequestContext } from '@/server/session'
import { CommentsForm } from '@/ui/admin/settings/CommentsForm'

export const meta = settingsMeta('评论与头像')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireAdmin(ctx)
  return null
}

export default function WpAdminSettingsCommentsRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <CommentsForm comments={bundle.comments} />
}
