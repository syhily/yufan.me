import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

export const adminCacheContract = c.router(
  {
    getCacheStats: {
      method: 'GET',
      path: '/admin/get-cache-stats/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'getCacheStats',
    },
    clearCache: {
      method: 'POST',
      path: '/admin/clear-cache',
      body: z.any() /* TODO: use clearCacheSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'clearCache',
    },
  },
  { strictStatusCodes: true },
)
