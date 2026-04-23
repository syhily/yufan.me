import { DateTime } from 'luxon'
import { redirect } from 'react-router'

const timeRegex = /^\d{4}$/

export async function loader({ params }: { params: { year?: string; time?: string } }) {
  const { year, time } = params
  if (year === undefined || !timeRegex.test(year) || time === undefined || !timeRegex.test(time)) {
    throw redirect('/404')
  }

  const [{ renderCalendar }, { loadBuffer }] = await Promise.all([
    import('@/services/images/calendar'),
    import('@/shared/cache.server'),
  ])
  const date = DateTime.fromFormat(`${year}-${time}`, 'yyyy-MMdd')
  const buffer = await loadBuffer(`calendar-${date.toFormat('yyyy-MM-dd')}`, () => renderCalendar(date), 24 * 60 * 60)

  return new Response(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'image/png' },
  })
}
