import type { ContractImpl } from '@/server/http/ts-rest-adapter'

import { parseAnalyticsSearch, queryCounters, queryHeatmap, queryMetric, queryViews } from '@/server/analytics/query'
import { METRIC_TYPES } from '@/shared/analytics/dto'
import { analyticsContract } from '@/shared/contracts/analytics'

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
  if (query.preset) {
    sp.set('preset', query.preset)
  }
  if (query.startAt) {
    sp.set('startAt', query.startAt)
  }
  if (query.endAt) {
    sp.set('endAt', query.endAt)
  }
  if (query.filters) {
    sp.set('filters', query.filters)
  }
  if (query.entityType) {
    sp.set('entityType', query.entityType)
  }
  if (query.entityId) {
    sp.set('entityId', query.entityId)
  }
  return parseAnalyticsSearch(sp)
}

export const analyticsController: ContractImpl<typeof analyticsContract> = {
  counters: async ({ query }) => {
    const input = buildAnalyticsInput(query)
    return { status: 200 as const, body: await queryCounters(input) }
  },

  views: async ({ query }) => {
    const input = buildAnalyticsInput(query)
    return { status: 200 as const, body: await queryViews(input) }
  },

  heatmap: async ({ query }) => {
    const input = buildAnalyticsInput(query)
    return { status: 200 as const, body: await queryHeatmap(input) }
  },

  metrics: async ({ query }) => {
    const input = buildAnalyticsInput(query)
    const type = query.type
    if (!METRIC_SET.has(type)) {
      return { status: 400 as const, body: { error: { message: `unknown metric type: ${type}` } } }
    }
    return {
      status: 200 as const,
      body: await queryMetric(input, type as (typeof METRIC_TYPES)[number], query.limit),
    }
  },
}
