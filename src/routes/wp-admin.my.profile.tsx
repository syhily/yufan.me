import { data } from 'react-router'

import { findUserById } from '@/server/db/query/user'
import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { MyProfileForm } from '@/ui/admin/my/MyProfileForm'

import type { Route } from './+types/wp-admin.my.profile'

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '个人信息' }, bundleFromMatches(matches))
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = getRouteRequestContext({ request, context })
  if (!user) {
    throw new Response('Unauthorized', { status: 401 })
  }
  const dbUser = await findUserById(BigInt(user.id))
  return data({
    name: dbUser?.name ?? '',
    email: dbUser?.email ?? '',
    link: dbUser?.link ?? '',
    role: dbUser?.role ?? null,
    badgeName: dbUser?.badgeName ?? '',
    badgeColor: dbUser?.badgeColor ?? '',
  })
}

export default function MyProfileRoute({ loaderData }: Route.ComponentProps) {
  return <MyProfileForm initial={loaderData} />
}
