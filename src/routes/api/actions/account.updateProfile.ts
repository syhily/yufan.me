import { z } from 'zod'

import { findUserById, updateUserById } from '@/server/db/query/user'
import { defineGuardedApiAction } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'

const schema = z.object({
  name: z.string().min(1).max(50).optional(),
  link: z.url().max(255).optional().nullable(),
  badgeName: z.string().max(20).optional().nullable(),
  badgeColor: z.string().max(7).optional().nullable(),
  badgeTextColor: z.string().max(7).optional().nullable(),
  receiveEmail: z.boolean().optional(),
})

export const action = defineGuardedApiAction({
  method: 'POST',
  input: schema,
  requireRole: 'visitor',
  async run({ payload, viewer }) {
    const userId = BigInt(viewer.userId)
    const dbUser = await findUserById(userId)
    if (!dbUser) {
      throw new ActionFailure(404, '用户不存在。')
    }
    // Visitors cannot set badge fields; authors and admins can.
    const canSetBadge = viewer.role === 'admin' || viewer.role === 'author'
    const patch: Parameters<typeof updateUserById>[1] = {}
    if (payload.name !== undefined) {
      patch.name = payload.name
    }
    if (payload.link !== undefined) {
      patch.link = payload.link ?? undefined
    }
    if (payload.receiveEmail !== undefined) {
      patch.receiveEmail = payload.receiveEmail
    }
    if (canSetBadge) {
      if (payload.badgeName !== undefined) {
        patch.badgeName = payload.badgeName ?? undefined
      }
      if (payload.badgeColor !== undefined) {
        patch.badgeColor = payload.badgeColor ?? undefined
      }
      if (payload.badgeTextColor !== undefined) {
        patch.badgeTextColor = payload.badgeTextColor ?? undefined
      }
    }
    const updated = await updateUserById(userId, patch)
    return { user: updated }
  },
})
