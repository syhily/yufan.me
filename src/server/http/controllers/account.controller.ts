import bcrypt from 'bcryptjs'

import type { accountContract } from '@/shared/contracts/account'

import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { findSessionMeta, revokeSessionById } from '@/server/auth/sessions'
import { findUserById, updateUserById } from '@/server/db/query/user'
import { forbidden, notFound, ok } from '@/server/http/response'
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
    const dbUser = await findUserById(BigInt(viewer.userId))
    if (!dbUser) {
      return notFound('用户不存在')
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
    return ok({ user: (await updateUserById(BigInt(viewer.userId), patch))! })
  },

  updatePassword: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const body = args.body as { oldPassword: string; newPassword: string }
    const viewer = requireViewer(ctx)
    const { session } = ctx
    const dbUser = await findUserById(BigInt(viewer.userId))
    if (!dbUser) {
      return notFound('用户不存在')
    }
    const ok_ = await bcrypt.compare(body.oldPassword, dbUser.password)
    if (!ok_) {
      return forbidden('原密码错误')
    }
    await updateUserById(dbUser.id, { password: await bcrypt.hash(body.newPassword, 12) })
    await revokeAllSessionsOfUser(dbUser.id, session.id)
    return ok({ success: true })
  },

  revokeSession: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const body = args.body as { sessionId: string }
    const viewer = requireViewer(ctx)
    const { session } = ctx
    const currentSession = body.sessionId === session.id
    const meta = await findSessionMeta(body.sessionId)
    if (!meta) {
      return ok({ success: true, currentSession })
    }
    if (meta.userId.toString() !== viewer.userId) {
      return forbidden('无权操作该会话')
    }
    await revokeSessionById(body.sessionId, meta.userId)
    return ok({ success: true, currentSession })
  },
}
