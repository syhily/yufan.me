import { listCategoriesSchema } from '@/server/categories/schema'
import { listCategoriesForAdmin } from '@/server/categories/service'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineGuardedApiAction({
  method: 'GET',
  input: listCategoriesSchema,
  requireRole: 'admin',
  async run({ payload }) {
    return listCategoriesForAdmin({ q: payload.q })
  },
})
