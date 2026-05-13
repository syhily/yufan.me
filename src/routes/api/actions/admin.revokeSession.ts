import { z } from 'zod'

import { findSessionMeta, revokeSessionById } from '@/server/auth/sessions'
import { getLogger } from '@/server/logger'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'

const log = getLogger('audit.session')

const schema = z.object({
  sessionId: z.string().min(1),
})

export const action = defineGuardedApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'admin',
  async run({ ctx, payload, viewer }) {
    // Admin revoke is intentionally permissive: an admin can revoke
    // their OWN current session — the UI surfaces a warning + login
    // redirect. The only safeguard is the audit log below.
    const currentSession = payload.sessionId === ctx.session.id
    const meta = await findSessionMeta(payload.sessionId)
    if (!meta) {
      // Idempotent: missing meta means already revoked / expired.
      return { success: true, currentSession } as const
    }
    await revokeSessionById(payload.sessionId, meta.userId)
    log.info('session revoked by admin', {
      actor: viewer.userId,
      target: meta.userId.toString(),
      sessionId: payload.sessionId,
      selfRevoke: currentSession,
    })
    return { success: true, currentSession } as const
  },
})
