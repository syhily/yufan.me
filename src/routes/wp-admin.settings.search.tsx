import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { requireAdmin } from '@/server/auth/rbac'
import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { getRouteRequestContext } from '@/server/session'
import { projectSearchForAdmin } from '@/server/settings/projection'
import { SearchForm } from '@/ui/admin/settings/SearchForm'

export const meta = settingsMeta('文章搜索')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireAdmin(ctx)
  return null
}

export default function WpAdminSettingsSearchRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <SearchForm search={projectSearchForAdmin(bundle.search)} />
}
