import { TZDate } from '@date-fns/tz'
import { addDays, addMonths, isAfter } from 'date-fns'

export function computeNextRun(
  settings: {
    frequency: 'daily' | 'weekly' | 'monthly'
    hour: number
    minute: number
    dayOfWeek?: number
    dayOfMonth?: number
  },
  timeZone: string,
  now: Date,
): Date {
  const tzNow = new TZDate(now, timeZone)
  let candidate: TZDate

  if (settings.frequency === 'daily') {
    candidate = new TZDate(
      tzNow.getFullYear(),
      tzNow.getMonth(),
      tzNow.getDate(),
      settings.hour,
      settings.minute,
      0,
      0,
      timeZone,
    )
    if (!isAfter(candidate, tzNow)) {
      candidate = addDays(candidate, 1)
    }
  } else if (settings.frequency === 'weekly') {
    const jsDay = settings.dayOfWeek === 7 ? 0 : settings.dayOfWeek!
    candidate = new TZDate(
      tzNow.getFullYear(),
      tzNow.getMonth(),
      tzNow.getDate(),
      settings.hour,
      settings.minute,
      0,
      0,
      timeZone,
    )
    const currentJsDay = candidate.getDay()
    let daysUntil = (jsDay - currentJsDay + 7) % 7
    if (daysUntil === 0 && !isAfter(candidate, tzNow)) {
      daysUntil = 7
    }
    candidate = addDays(candidate, daysUntil)
  } else {
    // monthly
    candidate = new TZDate(
      tzNow.getFullYear(),
      tzNow.getMonth(),
      settings.dayOfMonth!,
      settings.hour,
      settings.minute,
      0,
      0,
      timeZone,
    )
    if (!isAfter(candidate, tzNow)) {
      candidate = addMonths(candidate, 1)
    }
  }

  return candidate
}
