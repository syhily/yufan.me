import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { ContentForm } from '@/ui/admin/settings/ContentForm'

import type { Route } from './+types/wp-admin.settings.content'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '内容与分页' }, bundleFromMatches(matches))
}

export default function WpAdminSettingsContentRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <ContentForm content={bundle.content} />
}
