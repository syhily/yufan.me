import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin/settings/layout'

import { getRouteRequestContext } from '@/server/domains/auth/context'
import { requireRole } from '@/server/domains/auth/rbac'
import { settingsMeta } from '@/server/render/seo/settings-meta'
import { FooterForm } from '@/ui/admin/settings/FooterForm'

export const meta = settingsMeta('页脚')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export default function WpAdminSettingsFooterRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <FooterForm footer={bundle.footer.footer} socials={bundle.socials.socials} />
}
