import { z } from 'zod'

import type { BlogSettingsBundle } from '@/shared/blog-config-types'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

export const adminSettingsContract = c.router(
  {
    getSettings: {
      method: 'GET',
      path: '/admin/settings',
      responses: { 200: z.object({ bundle: z.custom<BlogSettingsBundle>().nullable() }), ...standardReadErrors },
      summary: 'getSettings',
    },
    updateSettings: {
      method: 'PATCH',
      path: '/admin/settings',
      body: z.object({ section: z.string(), payload: z.unknown() }),
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'updateSettings',
    },
  },
  { strictStatusCodes: true },
)
