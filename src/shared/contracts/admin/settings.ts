import { z } from 'zod'

import { c } from '../_base'
import { errorResponse, standardMutationErrors, standardReadErrors } from '../_errors'

const settingSection = z.enum([
  'general',
  'assets',
  'navigation',
  'socials',
  'content',
  'sidebar',
  'comments',
  'seo',
  'footer',
  'mail',
  'cache',
  'rateLimit',
  'search',
  'fonts',
])

export const getSettingsResponse = z.object({ bundle: z.record(z.string(), z.unknown()).nullable() })

export const updateSettingsResponse = z.object({ success: z.boolean() })

export const adminSettingsContract = c.router(
  {
    getSettings: {
      method: 'GET',
      path: '/admin/settings',
      responses: {
        200: getSettingsResponse,
        ...standardReadErrors,
      },
      summary: '管理后台：获取所有设置',
    },
    updateSettings: {
      method: 'PATCH',
      path: '/admin/settings',
      body: z.object({
        section: settingSection,
        payload: z.unknown(),
      }),
      responses: {
        200: updateSettingsResponse,
        ...standardMutationErrors,
      },
      summary: '管理后台：更新指定设置分组',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
