import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminSettingsContract = c.router(
  {
    getSettings: {
      method: 'GET',
      path: '/admin/get-settings/:id',
      pathParams: idParam,
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'getSettings',
    },
    updateSettings: {
      method: 'PATCH',
      path: '/admin/update-settings/:id',
      pathParams: idParam,
      body: z.any() /* TODO: use updateSettingsSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'updateSettings',
    },
  },
  { strictStatusCodes: true },
)
