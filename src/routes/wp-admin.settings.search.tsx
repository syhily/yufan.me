import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { projectSearchForAdmin } from '@/server/settings/projection'
import { SearchForm } from '@/ui/admin/settings/SearchForm'

export const meta = settingsMeta('文章搜索')

export default function WpAdminSettingsSearchRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <SearchForm search={projectSearchForAdmin(bundle.search)} />
}
