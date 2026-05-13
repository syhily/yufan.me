import { addMusicSchema } from '@/server/music/schema'
import { addMusic } from '@/server/music/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'
import { userSession } from '@/server/session'

export const action = defineApiAction({
  method: 'POST',
  input: addMusicSchema,
  requireRole: 'author',
  async run({ ctx, payload, viewer }) {
    const adminUser = userSession(ctx.session)!
    const music = await addMusic({
      source: payload.source,
      sourceId: payload.sourceId,
      uploader: { id: BigInt(viewer.userId), name: adminUser.name },
    })
    return { music }
  },
})
