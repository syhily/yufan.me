import type { APIRoute } from 'astro'
import { DateTime } from 'luxon'
import { loadBuffer } from '@/helpers/cache'
import { renderCalendar } from '@/helpers/images/calendar'

const timeRegex = /\d{4}/

export const GET: APIRoute = async ({ params, redirect }) => {
  const { year, time } = params
  if (year === undefined || !timeRegex.test(year) || time === undefined || !timeRegex.test(time)) {
    return redirect('/404')
  }
  const date = DateTime.fromFormat(`${year}-${time}`, 'yyyy-MMdd')
  const buffer = await loadBuffer(`calendar-${date.toFormat('yyyy-MM-dd')}`, () => renderCalendar(date), 24 * 60 * 60)

  return new Response(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'image/png' },
  })
}
