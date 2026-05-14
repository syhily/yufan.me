// Time-range / time-bucket primitives shared by the dashboard URL
// state, the analytics API loader, and the SQL query builder. Lives in
// `@/shared/` because both the React dashboard (URL ↔ state sync) and
// the SSR loader (range → SQL) need identical math — having two
// implementations drift apart is the kind of bug that quietly
// double-counts a Sunday.

export const PRESET_KEYS = ['last-1h', 'today', 'yesterday', 'last-7d', 'last-30d', 'last-90d', 'last-365d'] as const

export type PresetKey = (typeof PRESET_KEYS)[number]

export interface DateRange {
  /** Unix seconds, inclusive. */
  startAt: number
  /** Unix seconds, exclusive. */
  endAt: number
}

const HOUR = 60 * 60
const DAY = 24 * HOUR

export function computeDateRange(preset: PresetKey, now: Date = new Date()): DateRange {
  const nowSec = Math.floor(now.getTime() / 1000)
  switch (preset) {
    case 'last-1h':
      return { startAt: nowSec - HOUR, endAt: nowSec }
    case 'today': {
      const startOfDay = Math.floor(startOfLocalDay(now).getTime() / 1000)
      return { startAt: startOfDay, endAt: nowSec }
    }
    case 'yesterday': {
      const start = startOfLocalDay(now).getTime() / 1000 - DAY
      const end = start + DAY
      return { startAt: start, endAt: end }
    }
    case 'last-7d':
      return { startAt: nowSec - 7 * DAY, endAt: nowSec }
    case 'last-30d':
      return { startAt: nowSec - 30 * DAY, endAt: nowSec }
    case 'last-90d':
      return { startAt: nowSec - 90 * DAY, endAt: nowSec }
    case 'last-365d':
      return { startAt: nowSec - 365 * DAY, endAt: nowSec }
  }
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export type TimeBucket = '1 minute' | '15 minutes' | '1 hour' | '1 day'

// Pick a sensible bucket width so the rendered chart never has more
// than ~250 points and never fewer than ~12. Matches Sink's heuristic
// in `server/api/stats/views.get.ts:7-25`.
export function pickTimeBucket(range: DateRange): TimeBucket {
  const span = range.endAt - range.startAt
  if (span <= 2 * HOUR) {
    return '1 minute'
  }
  if (span <= 12 * HOUR) {
    return '15 minutes'
  }
  if (span <= 30 * DAY) {
    return '1 hour'
  }
  return '1 day'
}

// Which materialised view to read from. Reading the hypertable
// directly for very long ranges is fine on Timescale but pulls
// gigabytes of rows through the planner; the CAGs are essentially
// free for ranges they cover.
export type AggregateSource = 'access_log' | 'stats_hourly' | 'stats_daily'

export function pickAggregateSource(range: DateRange): AggregateSource {
  const span = range.endAt - range.startAt
  if (span <= 2 * DAY) {
    return 'access_log'
  }
  if (span <= 60 * DAY) {
    return 'stats_hourly'
  }
  return 'stats_daily'
}
