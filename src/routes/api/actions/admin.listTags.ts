import { defineApiAction } from '@/server/route-helpers/api-handler'
import { listTagsSchema } from '@/server/tags/schema'
import { listTagsForAdmin } from '@/server/tags/service'

export const loader = defineApiAction({
  method: 'GET',
  input: listTagsSchema,
  requireAdmin: true,
  async run({ payload }) {
    return listTagsForAdmin({ q: payload.q, offset: payload.offset, limit: payload.limit })
  },
})
