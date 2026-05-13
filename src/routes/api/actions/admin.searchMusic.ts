import { searchMusicSchema } from '@/server/music/schema'
import { searchMusic } from '@/server/music/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const loader = defineApiAction({
  method: 'GET',
  input: searchMusicSchema,
  requireRole: 'author',
  async run({ payload }) {
    return searchMusic(payload.keyword, payload.limit)
  },
})
