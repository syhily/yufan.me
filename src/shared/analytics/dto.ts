// DTOs returned by the analytics API loaders and consumed by the
// React dashboard. Plain data — no `Date`, no `bigint` — so the wire
// shape round-trips through React Router's loader serialisation
// unchanged.

import type { PresetKey } from '@/shared/analytics/time'

export const METRIC_TYPES = [
  'country',
  'region',
  'city',
  'referer',
  'language',
  'timezone',
  'os',
  'browser',
  'browserType',
  'device',
  'deviceType',
  'path',
] as const

export type MetricType = (typeof METRIC_TYPES)[number]

export const METRIC_GROUPS = ['location', 'referer', 'time', 'device', 'browser'] as const
export type MetricGroup = (typeof METRIC_GROUPS)[number]

export const METRIC_GROUP_TABS: Record<MetricGroup, MetricType[]> = {
  location: ['country', 'region', 'city'],
  referer: ['referer', 'path'],
  time: ['language', 'timezone'],
  device: ['device', 'deviceType'],
  browser: ['browser', 'os'],
}

export const FILTERABLE_TYPES = METRIC_TYPES

export type Filters = Partial<Record<MetricType, string>>

export interface AnalyticsQuery {
  preset?: PresetKey
  startAt?: number
  endAt?: number
  filters?: Filters
}

export interface CountersDto {
  visits: number
  visitors: number
  referers: number
}

export interface ViewsPoint {
  /** ISO 8601 timestamp at the start of the bucket. */
  time: string
  visits: number
  visitors: number
}

export interface HeatmapCell {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
  /** 0–23. */
  hour: number
  visits: number
  visitors: number
}

export interface MetricRow {
  name: string
  visits: number
  visitors: number
}

export interface RealtimeEvent {
  ts: string
  path: string
  country: string | null
  city: string | null
  browser: string | null
  os: string | null
  deviceType: string | null
  isBot: boolean
}
