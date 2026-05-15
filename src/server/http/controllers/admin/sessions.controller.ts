import type { ContractImpl, HandlerContext } from '@/server/http/ts-rest-adapter'
import type { adminSessionsContract } from '@/shared/contracts/admin/sessions'

import { findSessionMeta, listAllSessions, revokeSessionById } from '@/server/auth/sessions'
import { ok } from '@/server/http/response'
import { getLogger } from '@/server/logger'

const log = getLogger('audit.session')

export const adminSessionsController: ContractImpl<typeof adminSessionsContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    void (args.query as { q?: string; offset?: number; limit?: number })
    const result = await listAllSessions()
    return ok({ sessions: result as unknown[], total: result.length, hasMore: false })
  },

  revoke: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = ctx.viewer!
    const params = args.params as { sessionId: string }
    const currentSession = params.sessionId === ctx.session.id
    const meta = await findSessionMeta(params.sessionId)
    if (!meta) {
      return ok({ success: true, currentSession })
    }
    await revokeSessionById(params.sessionId, meta.userId)
    log.info('session revoked by admin', {
      actor: viewer.userId,
      target: meta.userId.toString(),
      sessionId: params.sessionId,
      selfRevoke: currentSession,
    })
    return ok({ success: true, currentSession })
  },
}
