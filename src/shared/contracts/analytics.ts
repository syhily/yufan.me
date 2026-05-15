import { z } from 'zod'

import { METRIC_TYPES } from '@/shared/analytics/dto'
import { PRESET_KEYS } from '@/shared/analytics/time'

import { c } from './_base'
import { standardReadErrors } from './_errors'

// ─── Schemas ────────────────────────────────────────────

const presetKey = z.enum(PRESET_KEYS as unknown as [string, ...string[]])

export const analyticsQuery = z.object({
  preset: presetKey.optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  filters: z.string().optional(),
  entityType: z.enum(['post', 'page']).optional(),
  entityId: z.string().optional(),
})

export const countersResponse = z.object({
  visits: z.number().int().nonnegative(),
  visitors: z.number().int().nonnegative(),
  referers: z.number().int().nonnegative(),
})

export const viewsPoint = z.object({
  time: z.string(),
  visits: z.number().int().nonnegative(),
  visitors: z.number().int().nonnegative(),
})

export const heatmapCell = z.object({
  weekday: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  visits: z.number().int().nonnegative(),
  visitors: z.number().int().nonnegative(),
})

export const metricRow = z.object({
  name: z.string(),
  visits: z.number().int().nonnegative(),
  visitors: z.number().int().nonnegative(),
})

export const metricsQuery = analyticsQuery.extend({
  type: z.enum(METRIC_TYPES as unknown as [string, ...string[]]),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ─── Contract ──────────────────────────────────────────

export const analyticsContract = c.router(
  {
    counters: {
      method: 'GET',
      path: '/analytics/counters',
      query: analyticsQuery,
      responses: {
        200: countersResponse,
        ...standardReadErrors,
      },
      summary: '统计概览：访问量、访客数、来源域名数',
    },

    views: {
      method: 'GET',
      path: '/analytics/views',
      query: analyticsQuery,
      responses: {
        200: z.array(viewsPoint),
        ...standardReadErrors,
      },
      summary: '趋势图数据',
    },

    heatmap: {
      method: 'GET',
      path: '/analytics/heatmap',
      query: analyticsQuery,
      responses: {
        200: z.array(heatmapCell),
        ...standardReadErrors,
      },
      summary: '热力图数据',
    },

    metrics: {
      method: 'GET',
      path: '/analytics/metrics',
      query: metricsQuery,
      responses: {
        200: z.array(metricRow),
        400: z.object({ error: z.object({ message: z.string() }) }),
        ...standardReadErrors,
      },
      summary: 'Top-N 指标列表',
    },
  },
  { strictStatusCodes: true },
)
