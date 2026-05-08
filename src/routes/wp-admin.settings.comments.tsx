import { useOutletContext } from 'react-router'

import type { SettingsOutletContext } from '@/routes/wp-admin.settings.layout'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { CommentsForm } from '@/ui/admin/settings/CommentsForm'

import type { Route } from './+types/wp-admin.settings.comments'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '评论与头像' }, bundleFromMatches(matches))
}

export default function WpAdminSettingsCommentsRoute() {
  const { bundle } = useOutletContext<SettingsOutletContext>()
  return <CommentsForm comments={bundle.comments} />
}
