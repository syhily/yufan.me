import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

export const adminSettingsContract = c.router(
  {
    getSettings: {
      method: 'GET',
      path: '/admin/settings',
      responses: { 200: z.any(), ...standardReadErrors },
      summary: 'getSettings',
    },
    updateSettings: {
      method: 'PATCH',
      path: '/admin/settings',
      body: z.any() /* TODO: use updateSettingsSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'updateSettings',
    },
  },
  { strictStatusCodes: true },
)
