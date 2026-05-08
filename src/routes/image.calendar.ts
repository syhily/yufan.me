import { serveCalendar } from '@/server/images/serve-calendar'

import type { Route } from './+types/image.calendar'

export function headers() {
  return { 'Cache-Control': 'public, max-age=86400' }
}

export async function loader({ params }: Route.LoaderArgs) {
  return serveCalendar(params, 'light', headers())
}
