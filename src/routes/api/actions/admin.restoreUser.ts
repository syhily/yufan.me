import { getLogger } from '@/server/logger'
import { ActionFailure, defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { userIdSchema } from '@/server/users/schema'
import { restoreAdminUser } from '@/server/users/service'

const log = getLogger('audit.user')

export const action = defineGuardedApiAction({
  method: 'POST',
  input: userIdSchema,
  requireRole: 'admin',
  async run({ payload, viewer }) {
    const ok = await restoreAdminUser(BigInt(payload.userId))
    if (!ok) {
      throw new ActionFailure(404, '用户不存在')
    }
    log.info('user restored', { actor: viewer.userId, target: payload.userId })
    return { success: true } as const
  },
})
