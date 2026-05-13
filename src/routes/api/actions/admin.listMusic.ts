import { listMusicSchema } from '@/server/music/schema'
import { listMusicForAdmin } from '@/server/music/service'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineGuardedApiAction({
  method: 'GET',
  input: listMusicSchema,
  requireRole: 'author',
  async run({ payload }) {
    return listMusicForAdmin({
      q: payload.q,
      offset: payload.offset,
      limit: payload.limit,
    })
  },
})
