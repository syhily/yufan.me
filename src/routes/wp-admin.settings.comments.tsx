import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { settingsMeta } from '@/server/route-helpers/settings-meta'
import { CommentsForm } from '@/ui/admin/settings/CommentsForm'

export const meta = settingsMeta('评论与头像')

export default function WpAdminSettingsCommentsRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <CommentsForm comments={bundle.comments} />
}
