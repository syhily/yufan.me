import type { LoaderFunctionArgs } from 'react-router'

import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { getRouteRequestContext } from '@/server/domains/auth/context'
import { requireRole } from '@/server/domains/auth/rbac'
import { settingsMeta } from '@/server/render/seo/settings-meta'
import { FontsForm } from '@/ui/admin/settings/FontsForm'

export const meta = settingsMeta('字体配置')

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = getRouteRequestContext({ request, context })
  requireRole(ctx, 'admin')
  return null
}

export default function WpAdminSettingsFontsRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return (
    <FontsForm
      fonts={
        bundle.fonts ?? {
          og: { url: '' },
          calendar: { url: '' },
          globalCss: [],
          postCss: [],
        }
      }
    />
  )
}
