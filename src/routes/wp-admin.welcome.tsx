import { useOutletContext } from 'react-router'

import { bundleFromMatches, routeMeta } from '@/server/seo/meta'
import { getRouteRequestContext } from '@/server/session'
import { WelcomeView } from '@/ui/admin/welcome/WelcomeView'

import type { Route } from './+types/wp-admin.welcome'

export async function loader({ request, context }: Route.LoaderArgs) {
  const { role, user } = getRouteRequestContext({ request, context })
  const hour = new Date().getHours()
  let greeting: string
  if (hour >= 23 || hour < 5) {
    greeting = 'deepnight'
  } else if (hour < 11) {
    greeting = 'morning'
  } else if (hour < 14) {
    greeting = 'noon'
  } else if (hour < 18) {
    greeting = 'afternoon'
  } else {
    greeting = 'evening'
  }
  return { role, userName: user?.name ?? '', greeting }
}

export function meta({ matches }: Route.MetaArgs) {
  return routeMeta({ title: '欢迎' }, bundleFromMatches(matches))
}

export default function WpAdminWelcomeRoute({ loaderData }: Route.ComponentProps) {
  const { currentUser } = useOutletContext<{
    csrfToken: string
    currentUser: { id: string; name: string; email: string }
  }>()
  return <WelcomeView role={loaderData.role} userName={currentUser.name} greeting={loaderData.greeting} />
}
