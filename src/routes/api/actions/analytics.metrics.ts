import { parseAnalyticsSearch, queryMetric } from '@/server/analytics/query'
import { ActionFailure, defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { METRIC_TYPES, type MetricType } from '@/shared/analytics/dto'

const METRIC_SET = new Set<string>(METRIC_TYPES)

export const loader = defineGuardedApiAction({
  method: 'GET',
  requireRole: 'admin',
  async run({ ctx }) {
    const input = parseAnalyticsSearch(ctx.url.searchParams)
    const type = ctx.url.searchParams.get('type') ?? ''
    if (!METRIC_SET.has(type)) {
      throw new ActionFailure(400, `unknown metric type: ${type}`)
    }
    const limitRaw = Number.parseInt(ctx.url.searchParams.get('limit') ?? '20', 10)
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 20
    return await queryMetric(input, type as MetricType, limit)
  },
})
