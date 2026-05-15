import { HTTPException } from 'hono/http-exception'

import type { CountersDto, HeatmapCell, MetricRow, ViewsPoint } from '@/shared/analytics/dto'

import { parseAnalyticsSearch, queryCounters, queryHeatmap, queryMetric, queryViews } from '@/server/analytics/query'
import { METRIC_TYPES } from '@/shared/analytics/dto'

const METRIC_SET = new Set<string>(METRIC_TYPES)

function buildAnalyticsInput(query: {
  preset?: string
  startAt?: string
  endAt?: string
  filters?: string
  entityType?: string
  entityId?: string
}) {
  const sp = new URLSearchParams()
  if (query.preset) sp.set('preset', query.preset)
  if (query.startAt) sp.set('startAt', query.startAt)
  if (query.endAt) sp.set('endAt', query.endAt)
  if (query.filters) sp.set('filters', query.filters)
  if (query.entityType) sp.set('entityType', query.entityType)
  if (query.entityId) sp.set('entityId', query.entityId)
  return parseAnalyticsSearch(sp)
}

export const analyticsController = {
  counters: async ({
    query,
  }: {
    query: {
      preset?: string
      startAt?: string
      endAt?: string
      filters?: string
      entityType?: string
      entityId?: string
    }
  }) => {
    const input = buildAnalyticsInput(query)
    return { status: 200 as const, body: (await queryCounters(input)) as CountersDto }
  },

  views: async ({
    query,
  }: {
    query: {
      preset?: string
      startAt?: string
      endAt?: string
      filters?: string
      entityType?: string
      entityId?: string
    }
  }) => {
    const input = buildAnalyticsInput(query)
    return { status: 200 as const, body: (await queryViews(input)) as ViewsPoint[] }
  },

  heatmap: async ({
    query,
  }: {
    query: {
      preset?: string
      startAt?: string
      endAt?: string
      filters?: string
      entityType?: string
      entityId?: string
    }
  }) => {
    const input = buildAnalyticsInput(query)
    return { status: 200 as const, body: (await queryHeatmap(input)) as HeatmapCell[] }
  },

  metrics: async ({
    query,
  }: {
    query: {
      preset?: string
      startAt?: string
      endAt?: string
      filters?: string
      entityType?: string
      entityId?: string
      type: string
      limit: number
    }
  }) => {
    const input = buildAnalyticsInput(query)
    const type = query.type
    if (!METRIC_SET.has(type)) {
      throw new HTTPException(400, { message: `unknown metric type: ${type}` })
    }
    return {
      status: 200 as const,
      body: (await queryMetric(input, type as (typeof METRIC_TYPES)[number], query.limit)) as MetricRow[],
    }
  },
}
