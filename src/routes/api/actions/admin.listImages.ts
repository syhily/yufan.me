import { listImagesSchema } from '@/server/images/schema'
import { listImagesForAdmin } from '@/server/images/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  input: listImagesSchema,
  requireAdmin: true,
  async run({ payload }) {
    return listImagesForAdmin({
      q: payload.q,
      kind: payload.kind,
      offset: payload.offset,
      limit: payload.limit,
    })
  },
})
