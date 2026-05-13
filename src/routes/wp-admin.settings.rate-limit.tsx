import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { RateLimitForm } from '@/ui/admin/settings/RateLimitForm'

export const meta = settingsMeta('流控设置')

export default function WpAdminSettingsRateLimitRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <RateLimitForm rateLimit={bundle.rateLimit} />
}
