import { useOutletContext } from 'react-router'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { MyProfileView } from '@/ui/admin/my/MyProfileView'

import type { Route } from './+types/wp-admin.my.profile'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '个人信息' }, bundleFromMatches(matches))
}

export default function WpAdminMyProfileRoute() {
  const { csrfToken, currentUser } = useOutletContext<{
    csrfToken: string
    currentUser: { id: string; name: string; email: string; role?: string | null }
  }>()
  return <MyProfileView csrfToken={csrfToken} currentUser={currentUser} />
}
