import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { SocialsEditor } from '@/ui/admin/settings/SocialsEditor'

import type { Route } from './+types/wp-admin.settings.socials'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '社交链接' }, bundleFromMatches(matches))
}

export default function WpAdminSettingsSocialsRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <SocialsEditor socials={bundle.socials} />
}
