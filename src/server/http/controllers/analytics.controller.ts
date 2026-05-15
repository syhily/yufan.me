import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { analyticsContract } from '@/shared/contracts/analytics'

import { parseAnalyticsSearch, queryCounters, queryHeatmap, queryMetric, queryViews } from '@/server/analytics/query'
import { ok, badRequest } from '@/server/http/response'
import { METRIC_TYPES, type MetricType } from '@/shared/analytics/dto'

const METRIC_SET = new Set<string>(METRIC_TYPES)

function parseQuery(q: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined) {
      params.set(k, v)
    }
  }
  return params
}

export const analyticsController: ContractImpl<typeof analyticsContract> = {
  counters: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const input = parseAnalyticsSearch(parseQuery(args.query as Record<string, string>))
    return ok(await queryCounters(input))
  },

  views: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const input = parseAnalyticsSearch(parseQuery(args.query as Record<string, string>))
    return ok(await queryViews(input))
  },

  heatmap: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const input = parseAnalyticsSearch(parseQuery(args.query as Record<string, string>))
    return ok(await queryHeatmap(input))
  },

  metrics: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = args.query as Record<string, string>
    const params = parseQuery(q)
    const input = parseAnalyticsSearch(params)
    const type = q.type ?? ''
    if (!METRIC_SET.has(type)) {
      return badRequest(`unknown metric type: ${type}`)
    }
    const limitRaw = Number.parseInt(q.limit ?? '20', 10)
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 20
    return ok(await queryMetric(input, type as MetricType, limit))
  },
}
