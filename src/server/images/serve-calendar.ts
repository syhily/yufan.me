import { format, isValid, parse } from 'date-fns'

import { type CalendarTheme, renderCalendar } from '@/server/images/calendar'
import { loadBuffer } from '@/server/infra/cache/image'
import { notFound, pngResponse } from '@/server/present/response/http'
import { requireBlogSettingsSection } from '@/shared/config/blog'

const timeRegex = /^\d{4}$/

export async function serveCalendar(
  params: { year?: string; time?: string },
  theme: CalendarTheme,
  responseHeaders: HeadersInit,
): Promise<Response> {
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

  // Read prefix + TTL from the live snapshot so admin renames in
  // `/wp-admin/settings/cache` apply to the very next render. Dark
  // variants get a distinct cache key so the two themes don't clobber
  // each other under the same prefix.
  const cache = requireBlogSettingsSection('cache').cache.calendar
  const themeSuffix = theme === 'dark' ? '-dark' : ''
  const buffer = await loadBuffer(
    `${cache.prefix}${format(date, 'yyyy-MM-dd')}${themeSuffix}`,
    () => renderCalendar(date, theme),
    cache.ttlSeconds,
  )

  return pngResponse(buffer, responseHeaders)
}
