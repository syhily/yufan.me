import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { requireAdmin } from '@/server/auth/rbac'
import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { getRouteRequestContext } from '@/server/session'
import { FooterForm } from '@/ui/admin/settings/FooterForm'

export const meta = settingsMeta('页脚')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireAdmin(ctx)
  return null
}

export default function WpAdminSettingsFooterRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <FooterForm footer={bundle.footer.footer} />
}
