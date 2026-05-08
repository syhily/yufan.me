import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { GeneralForm } from '@/ui/admin/settings/GeneralForm'

import type { Route } from './+types/wp-admin.settings.general'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '基本信息' }, bundleFromMatches(matches))
}

export default function WpAdminSettingsGeneralRoute() {
  const { bundle, timeZones } = useOutletContext<SettingsOutletContext>()
  return <GeneralForm siteIdentity={bundle.siteIdentity} timeZones={timeZones} />
}
