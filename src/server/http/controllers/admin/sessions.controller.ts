import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { adminSessionsContract } from '@/shared/contracts/admin/sessions'

import { findSessionMeta, listAllSessions, revokeSessionById } from '@/server/auth/sessions'
import { ok } from '@/server/http/response'
import { params } from '@/server/http/ts-rest-adapter'
import { getLogger } from '@/server/logger'

const log = getLogger('audit.session')

interface RevokeSessionParams {
  sessionId: string
}

export const adminSessionsController: ContractImpl<typeof adminSessionsContract> = {
  list: async (_args: Record<string, unknown>, _ctx: HandlerContext) => {
    const result = await listAllSessions()
    return ok({ sessions: result as unknown[], total: result.length, hasMore: false })
  },

  revoke: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = ctx.viewer!
    const p = params<RevokeSessionParams>(args)
    const currentSession = p.sessionId === ctx.session.id
    const meta = await findSessionMeta(p.sessionId)
    if (!meta) {
      return ok({ success: true, currentSession })
    }
    await revokeSessionById(p.sessionId, meta.userId)
    log.info('session revoked by admin', {
      actor: viewer.userId,
      target: meta.userId.toString(),
      sessionId: p.sessionId,
      selfRevoke: currentSession,
    })
    return ok({ success: true, currentSession })
  },
}
