import { z } from 'zod'

import { c } from './_base'
import { standardReadErrors } from './_errors'

export const analyticsQuery = z.object({
  preset: z.string().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  filters: z.string().optional(),
  entityType: z.enum(['post', 'page']).optional(),
  entityId: z.string().optional(),
})

export const metricQuery = analyticsQuery.extend({
  type: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

const viewsPoint = z.object({
  time: z.string(),
  visits: z.number(),
  visitors: z.number(),
})

const heatmapCell = z.object({
  weekday: z.number(),
  hour: z.number(),
  visits: z.number(),
  visitors: z.number(),
})

const metricRow = z.object({
  name: z.string(),
  visits: z.number(),
  visitors: z.number(),
})

export const analyticsContract = c.router(
  {
    counters: {
      method: 'GET',
      path: '/analytics/counters',
      query: analyticsQuery,
      responses: {
        200: z.object({ visits: z.number(), visitors: z.number(), referers: z.number() }),
        ...standardReadErrors,
      },
      summary: '分析面板：访问计数摘要',
    },

    views: {
      method: 'GET',
      path: '/analytics/views',
      query: analyticsQuery,
      responses: {
        200: z.array(viewsPoint),
        ...standardReadErrors,
      },
      summary: '分析面板：时序访问量数据',
    },

    heatmap: {
      method: 'GET',
      path: '/analytics/heatmap',
      query: analyticsQuery,
      responses: {
        200: z.array(heatmapCell),
        ...standardReadErrors,
      },
      summary: '分析面板：访问热力图数据',
    },

    metrics: {
      method: 'GET',
      path: '/analytics/metrics',
      query: metricQuery,
      responses: {
        200: z.array(metricRow),
        ...standardReadErrors,
      },
      summary: '分析面板：按维度聚合的指标',
    },
  },
  { strictStatusCodes: true },
)
