import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { RateLimitForm } from '@/ui/admin/settings/RateLimitForm'

import type { Route } from './+types/wp-admin.settings.rate-limit'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '流控设置' }, bundleFromMatches(matches))
}

export default function WpAdminSettingsRateLimitRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <RateLimitForm rateLimit={bundle.rateLimit} />
}
