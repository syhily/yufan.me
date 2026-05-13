import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { FooterForm } from '@/ui/admin/settings/FooterForm'

export const meta = settingsMeta('页脚')

export default function WpAdminSettingsFooterRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <FooterForm footer={bundle.footer.footer} />
}
