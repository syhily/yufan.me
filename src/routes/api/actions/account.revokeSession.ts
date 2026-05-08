import { z } from 'zod'

import { findSessionMeta, revokeSessionById } from '@/server/auth/sessions'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const schema = z.object({
  sessionId: z.string().min(1),
})

export const action = defineGuardedApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'visitor',
  async run({ ctx, payload, viewer }) {
    // Allow revoking the current cookie too — the UI surfaces a
    // dedicated warning and redirects to the login page on success.
    // Returning `currentSession: true` lets the client distinguish a
    // self-revoke from a same-account-other-device revoke without an
    // extra round trip.
    const currentSession = payload.sessionId === ctx.session.id
    const meta = await findSessionMeta(payload.sessionId)
    if (!meta) {
      // Already revoked / expired — treat as success so a stale UI
      // re-revalidates without an error toast.
      return { success: true, currentSession } as const
    }
    if (meta.userId.toString() !== viewer.userId) {
      throw new ActionFailure(403, '无权操作该会话。')
    }
    await revokeSessionById(payload.sessionId, meta.userId)
    return { success: true, currentSession } as const
  },
})
