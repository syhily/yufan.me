import { DateTime } from 'luxon'

import { loadBuffer } from '@/server/cache/image'
import { notFound, pngResponse } from '@/server/route-helpers/http'
import { requireBlogSettingsSection } from '@/shared/blog-config'

import type { Route } from './+types/image.calendar'

const timeRegex = /^\d{4}$/

export function headers() {
  return { 'Cache-Control': 'public, max-age=86400' }
}

export async function loader({ params }: Route.LoaderArgs) {
  const { year, time } = params
  if (year === undefined || !timeRegex.test(year) || time === undefined || !timeRegex.test(time)) {
    notFound()
  }

  const rawDate = `${year}-${time}`
  const date = DateTime.fromFormat(rawDate, 'yyyy-MMdd')
  if (!date.isValid || date.toFormat('yyyy-MMdd') !== rawDate) {
    notFound()
  }

  const { renderCalendar } = await import('@/server/images/calendar')
  // Read prefix + TTL from the live snapshot so admin renames in
  // `/wp-admin/settings/cache` apply to the very next render.
  const cache = requireBlogSettingsSection('cache').cache.calendar
  const buffer = await loadBuffer(
    `${cache.prefix}${date.toFormat('yyyy-MM-dd')}`,
    () => renderCalendar(date),
    cache.ttlSeconds,
  )

  return pngResponse(buffer, headers())
}
