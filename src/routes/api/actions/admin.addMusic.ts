import { addMusicSchema } from '@/server/music/schema'
import { addMusic } from '@/server/music/service'
import { ActionFailure, defineApiAction } from '@/server/route-helpers/api-handler'
import { userSession } from '@/server/session'

export const action = defineApiAction({
  method: 'POST',
  input: addMusicSchema,
  requireAdmin: true,
  async run({ ctx, payload }) {
    const adminUser = userSession(ctx.session)
    if (adminUser === undefined) {
      throw new ActionFailure(403, '需要管理员登录')
    }
    const music = await addMusic({
      source: payload.source,
      sourceId: payload.sourceId,
      uploader: { id: BigInt(adminUser.id), name: adminUser.name },
    })
    return { music }
  },
})
