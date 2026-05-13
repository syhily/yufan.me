import { z } from 'zod'

import { updateUserById } from '@/server/db/query/user'
import { defineApiAction, ActionFailure } from '@/server/route-helpers/api-handler'

const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  link: z.string().max(2048).nullable().optional(),
  badgeName: z.string().max(50).nullable().optional(),
  badgeColor: z.string().max(7).nullable().optional(),
  badgeTextColor: z.string().max(7).nullable().optional(),
  receiveEmail: z.boolean().optional(),
})

export const action = defineApiAction({
  method: 'POST',
  input: updateProfileSchema,
  requireRole: 'visitor',
  async run({ ctx, payload }) {
    const userId = BigInt(ctx.session.get('user')?.id ?? '0')
    const role = ctx.role

    // Visitors cannot set badge fields.
    const patch: Record<string, unknown> = {}
    if (payload.name !== undefined) {
      patch.name = payload.name
    }
    if (payload.link !== undefined) {
      patch.link = payload.link
    }
    if (payload.receiveEmail !== undefined) {
      patch.receiveEmail = payload.receiveEmail
    }

    // Only admin/author can set badge fields.
    if (role === 'admin' || role === 'author') {
      if (payload.badgeName !== undefined) {
        patch.badgeName = payload.badgeName
      }
      if (payload.badgeColor !== undefined) {
        patch.badgeColor = payload.badgeColor
      }
      if (payload.badgeTextColor !== undefined) {
        patch.badgeTextColor = payload.badgeTextColor
      }
    }

    const updated = await updateUserById(userId, patch as Parameters<typeof updateUserById>[1])
    if (updated === null) {
      throw new ActionFailure(404, '用户不存在。')
    }

    // Refresh the session user data.
    ctx.session.set('user', {
      id: String(updated.id),
      name: updated.name,
      email: updated.email,
      website: updated.link,
      role: updated.role as 'admin' | 'author' | 'visitor' | null,
    })

    return { ok: true }
  },
})
