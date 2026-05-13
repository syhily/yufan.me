import { z } from 'zod'

import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { findUserById } from '@/server/db/query/user'
import { getLogger } from '@/server/logger'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const log = getLogger('audit.session')

const schema = z.object({
  userId: z.string().min(1),
})

export const action = defineGuardedApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'admin',
  async run({ payload, viewer }) {
    let targetId: bigint
    try {
      targetId = BigInt(payload.userId)
    } catch {
      throw new ActionFailure(400, '用户 ID 无效。')
    }
    const target = await findUserById(targetId)
    if (!target) {
      throw new ActionFailure(404, '用户不存在。')
    }
    await revokeAllSessionsOfUser(targetId)
    log.info('all sessions revoked by admin', {
      actor: viewer.userId,
      target: payload.userId,
    })
    return { success: true } as const
  },
})
