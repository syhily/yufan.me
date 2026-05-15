import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { analyticsContract } from '@/shared/contracts/analytics'

import { parseAnalyticsSearch, queryCounters, queryHeatmap, queryMetric, queryViews } from '@/server/analytics/query'
import { ok, badRequest } from '@/server/http/response'
import { query } from '@/server/http/ts-rest-adapter'
import { METRIC_TYPES, type MetricType } from '@/shared/analytics/dto'

const METRIC_SET = new Set<string>(METRIC_TYPES)

function analyticsInput(q: Record<string, string>) {
  return parseAnalyticsSearch(new URLSearchParams(q))
}

export const analyticsController: ContractImpl<typeof analyticsContract> = {
  counters: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<Record<string, string>>(args)
    return ok(await queryCounters(analyticsInput(q)))
  },

  views: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<Record<string, string>>(args)
    return ok(await queryViews(analyticsInput(q)))
  },

  heatmap: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<Record<string, string>>(args)
    return ok(await queryHeatmap(analyticsInput(q)))
  },

  metrics: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<Record<string, string>>(args)
    const input = analyticsInput(q)
    const type = q.type ?? ''
    if (!METRIC_SET.has(type)) {
      return badRequest(`unknown metric type: ${type}`)
    }
    const limitRaw = Number.parseInt(q.limit ?? '20', 10)
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 20
    return ok(await queryMetric(input, type as MetricType, limit))
  },
}
