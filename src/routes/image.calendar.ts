import { format, isValid, parse } from 'date-fns'

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

  // `time` is `MMdd`, e.g. `0424`. Reassemble into the full string
  // and parse it through date-fns — the round-trip equality check
  // (`format(date) === rawDate`) catches any value the parser would
  // silently accept by rolling over (e.g. month 13 → next year's
  // January) and rejects with a 404 instead of returning a different
  // calendar than the URL asked for.
  const rawDate = `${year}-${time}`
  const date = parse(rawDate, 'yyyy-MMdd', new Date())
  if (!isValid(date) || format(date, 'yyyy-MMdd') !== rawDate) {
    notFound()
  }

  const { renderCalendar } = await import('@/server/images/calendar')
  // Read prefix + TTL from the live snapshot so admin renames in
  // `/wp-admin/settings/cache` apply to the very next render.
  const cache = requireBlogSettingsSection('cache').cache.calendar
  const buffer = await loadBuffer(
    `${cache.prefix}${format(date, 'yyyy-MM-dd')}`,
    () => renderCalendar(date),
    cache.ttlSeconds,
  )

  return pngResponse(buffer, headers())
}
