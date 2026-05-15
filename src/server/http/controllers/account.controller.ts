import bcrypt from 'bcryptjs'

import type { accountContract } from '@/shared/contracts/account'

import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { findSessionMeta, revokeSessionById } from '@/server/auth/sessions'
import { findUserById, updateUserById } from '@/server/db/query/user'
import { requireViewer, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'

export const accountController: ContractImpl<typeof accountContract> = {
  updateProfile: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const body = args.body as {
      name?: string
      link?: string | null
      badgeName?: string | null
      badgeColor?: string | null
      badgeTextColor?: string | null
      receiveEmail?: boolean
    }
    const viewer = requireViewer(ctx)
    const userId = BigInt(viewer.userId)
    const dbUser = await findUserById(userId)
    if (!dbUser) {
      return { status: 404, body: { error: { message: '用户不存在' } } }
    }

    const canSetBadge = viewer.role === 'admin' || viewer.role === 'author'
    const patch: Parameters<typeof updateUserById>[1] = {}
    if (body.name !== undefined) {
      patch.name = body.name
    }
    if (body.link !== undefined) {
      patch.link = body.link ?? undefined
    }
    if (body.receiveEmail !== undefined) {
      patch.receiveEmail = body.receiveEmail
    }
    if (canSetBadge) {
      if (body.badgeName !== undefined) {
        patch.badgeName = body.badgeName ?? undefined
      }
      if (body.badgeColor !== undefined) {
        patch.badgeColor = body.badgeColor ?? undefined
      }
      if (body.badgeTextColor !== undefined) {
        patch.badgeTextColor = body.badgeTextColor ?? undefined
      }
    }
    const updated = await updateUserById(userId, patch)
    return { status: 200, body: { user: updated! } }
  },

  updatePassword: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const body = args.body as { oldPassword: string; newPassword: string }
    const viewer = requireViewer(ctx)
    const { session } = ctx
    const dbUser = await findUserById(BigInt(viewer.userId))
    if (!dbUser) {
      return { status: 404, body: { error: { message: '用户不存在' } } }
    }
    const ok = await bcrypt.compare(body.oldPassword, dbUser.password)
    if (!ok) {
      return { status: 403, body: { error: { message: '原密码错误' } } }
    }
    const hashed = await bcrypt.hash(body.newPassword, 12)
    await updateUserById(dbUser.id, { password: hashed })
    await revokeAllSessionsOfUser(dbUser.id, session.id)
    return { status: 200, body: { success: true } }
  },

  revokeSession: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const body = args.body as { sessionId: string }
    const viewer = requireViewer(ctx)
    const { session } = ctx
    const currentSession = body.sessionId === session.id
    const meta = await findSessionMeta(body.sessionId)
    if (!meta) {
      return { status: 200, body: { success: true, currentSession } }
    }
    if (meta.userId.toString() !== viewer.userId) {
      return { status: 403, body: { error: { message: '无权操作该会话' } } }
    }
    await revokeSessionById(body.sessionId, meta.userId)
    return { status: 200, body: { success: true, currentSession } }
  },
}
