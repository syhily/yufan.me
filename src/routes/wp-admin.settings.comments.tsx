import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { routeMeta } from '@/server/seo/meta'
import { CommentsForm } from '@/ui/admin/settings/CommentsForm'

export function meta() {
  return routeMeta({ title: '评论与头像' })
}

export default function WpAdminSettingsCommentsRoute() {
  const { settings, csrfToken } = useOutletContext<SettingsOutletContext>()
  return <CommentsForm settings={settings} csrfToken={csrfToken} />
}
