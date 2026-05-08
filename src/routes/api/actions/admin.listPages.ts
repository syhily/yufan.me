import { listPagesSchema } from '@/server/cms/pages/schema'
import { listPagesForAdmin } from '@/server/cms/pages/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  input: listPagesSchema,
  requireAdmin: true,
  async run({ payload }) {
    return listPagesForAdmin({
      q: payload.q,
      includeDeleted: payload.includeDeleted,
      offset: payload.offset,
      limit: payload.limit,
    })
  },
})
