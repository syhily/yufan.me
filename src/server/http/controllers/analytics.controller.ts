import { ORPCError } from '@orpc/server'
import { z } from 'zod'

import { parseAnalyticsSearch, queryCounters, queryHeatmap, queryMetric, queryViews } from '@/server/analytics/query'
import { adminProc } from '@/server/http/orpc-base'
import { METRIC_TYPES } from '@/shared/analytics/dto'
import { PRESET_KEYS } from '@/shared/analytics/time'

const presetKey = z.enum(PRESET_KEYS as unknown as [string, ...string[]])

const analyticsInput = z.object({
  preset: presetKey.optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  filters: z.string().optional(),
  entityType: z.enum(['post', 'page']).optional(),
  entityId: z.string().optional(),
})

const metricsInput = analyticsInput.extend({
  type: z.enum(METRIC_TYPES as unknown as [string, ...string[]]),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const countersOutput = z.object({
  visits: z.coerce.number().int().nonnegative(),
  visitors: z.coerce.number().int().nonnegative(),
  referers: z.coerce.number().int().nonnegative(),
})

const viewsPointOutput = z.object({
  time: z.string(),
  visits: z.coerce.number().int().nonnegative(),
  visitors: z.coerce.number().int().nonnegative(),
})

const heatmapCellOutput = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  hour: z.coerce.number().int().min(0).max(23),
  visits: z.coerce.number().int().nonnegative(),
  visitors: z.coerce.number().int().nonnegative(),
})

const metricRowOutput = z.object({
  name: z.string(),
  visits: z.coerce.number().int().nonnegative(),
  visitors: z.coerce.number().int().nonnegative(),
})

const METRIC_SET = new Set<string>(METRIC_TYPES)

function buildAnalyticsInput(input: z.infer<typeof analyticsInput>) {
  const sp = new URLSearchParams()
  if (input.preset) {
    sp.set('preset', input.preset)
  }
  if (input.startAt) {
    sp.set('startAt', input.startAt)
  }
  if (input.endAt) {
    sp.set('endAt', input.endAt)
  }
  if (input.filters) {
    sp.set('filters', input.filters)
  }
  if (input.entityType) {
    sp.set('entityType', input.entityType)
  }
  if (input.entityId) {
    sp.set('entityId', input.entityId)
  }
  return parseAnalyticsSearch(sp)
}

const counters = adminProc
  .input(analyticsInput)
  .output(countersOutput)
  .handler(({ input }) => queryCounters(buildAnalyticsInput(input)))

const views = adminProc
  .input(analyticsInput)
  .output(z.array(viewsPointOutput))
  .handler(({ input }) => queryViews(buildAnalyticsInput(input)))

const heatmap = adminProc
  .input(analyticsInput)
  .output(z.array(heatmapCellOutput))
  .handler(({ input }) => queryHeatmap(buildAnalyticsInput(input)))

const metrics = adminProc
  .input(metricsInput)
  .output(z.array(metricRowOutput))
  .handler(({ input }) => {
    if (!METRIC_SET.has(input.type)) {
      throw new ORPCError('BAD_REQUEST', { message: `unknown metric type: ${input.type}` })
    }
    return queryMetric(buildAnalyticsInput(input), input.type as (typeof METRIC_TYPES)[number], input.limit)
  })

export const analyticsRouter = { counters, views, heatmap, metrics }
