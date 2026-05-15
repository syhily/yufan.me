import bcrypt from 'bcryptjs'

import type { accountContract } from '@/shared/contracts/account'

import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { findSessionMeta, revokeSessionById } from '@/server/auth/sessions'
import { findUserById, updateUserById } from '@/server/db/query/user'
import { forbidden, notFound, ok } from '@/server/http/response'
import { body, asId, requireViewer, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'

interface UpdateProfileBody {
  name?: string
  link?: string | null
  badgeName?: string | null
  badgeColor?: string | null
  badgeTextColor?: string | null
  receiveEmail?: boolean
}

interface UpdatePasswordBody {
  oldPassword: string
  newPassword: string
}

interface RevokeSessionBody {
  sessionId: string
}

export const accountController: ContractImpl<typeof accountContract> = {
  updateProfile: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const b = body<UpdateProfileBody>(args)
    const viewer = requireViewer(ctx)
    const dbUser = await findUserById(asId(viewer.userId))
    if (!dbUser) {
      return notFound('用户不存在')
    }

    const canSetBadge = viewer.role === 'admin' || viewer.role === 'author'
    const patch: Parameters<typeof updateUserById>[1] = {}
    if (b.name !== undefined) {
      patch.name = b.name
    }
    if (b.link !== undefined) {
      patch.link = b.link ?? undefined
    }
    if (b.receiveEmail !== undefined) {
      patch.receiveEmail = b.receiveEmail
    }
    if (canSetBadge) {
      if (b.badgeName !== undefined) {
        patch.badgeName = b.badgeName ?? undefined
      }
      if (b.badgeColor !== undefined) {
        patch.badgeColor = b.badgeColor ?? undefined
      }
      if (b.badgeTextColor !== undefined) {
        patch.badgeTextColor = b.badgeTextColor ?? undefined
      }
    }
    return ok({ user: (await updateUserById(asId(viewer.userId), patch))! })
  },

  updatePassword: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const b = body<UpdatePasswordBody>(args)
    const viewer = requireViewer(ctx)
    const { session } = ctx
    const dbUser = await findUserById(asId(viewer.userId))
    if (!dbUser) {
      return notFound('用户不存在')
    }
    const ok_ = await bcrypt.compare(b.oldPassword, dbUser.password)
    if (!ok_) {
      return forbidden('原密码错误')
    }
    await updateUserById(dbUser.id, { password: await bcrypt.hash(b.newPassword, 12) })
    await revokeAllSessionsOfUser(dbUser.id, session.id)
    return ok({ success: true })
  },

  revokeSession: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const b = body<RevokeSessionBody>(args)
    const viewer = requireViewer(ctx)
    const { session } = ctx
    const currentSession = b.sessionId === session.id
    const meta = await findSessionMeta(b.sessionId)
    if (!meta) {
      return ok({ success: true, currentSession })
    }
    if (meta.userId.toString() !== viewer.userId) {
      return forbidden('无权操作该会话')
    }
    await revokeSessionById(b.sessionId, meta.userId)
    return ok({ success: true, currentSession })
  },
}
