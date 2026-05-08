import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { SeoForm } from '@/ui/admin/settings/SeoForm'

import type { Route } from './+types/wp-admin.settings.seo'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: 'SEO 与目录' }, bundleFromMatches(matches))
}

export default function WpAdminSettingsSeoRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <SeoForm seo={bundle.seo} />
}
