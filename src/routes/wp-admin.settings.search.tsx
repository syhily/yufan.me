import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { getRouteRequestContext } from '@/server/domains/auth/context'
import { requireRole } from '@/server/domains/auth/rbac'
import { projectSearchForAdmin } from '@/server/domains/settings/projection'
import { settingsMeta } from '@/server/render/seo/settings-meta'
import { SearchForm } from '@/ui/admin/settings/SearchForm'

export const meta = settingsMeta('文章搜索')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export default function WpAdminSettingsSearchRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <SearchForm search={projectSearchForAdmin(bundle.search)} />
}
