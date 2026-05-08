import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { FooterForm } from '@/ui/admin/settings/FooterForm'

import type { Route } from './+types/wp-admin.settings.footer'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '页脚' }, bundleFromMatches(matches))
}

export default function WpAdminSettingsFooterRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <FooterForm footer={bundle.footer.footer} />
}
