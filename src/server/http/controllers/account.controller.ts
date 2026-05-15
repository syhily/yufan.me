import bcrypt from 'bcryptjs'

import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'

import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { findSessionMeta, revokeSessionById } from '@/server/auth/sessions'
import { findUserById, updateUserById } from '@/server/db/query/user'
import { accountContract } from '@/shared/contracts/account'

export const accountController: AuthedContractImpl<typeof accountContract> = {
  updateProfile: async ({ body }, { viewer }) => {
    if (!viewer) {
      return { status: 401 as const, body: { error: { message: '未登录' } } }
    }
    const userId = BigInt(viewer.userId)
    const dbUser = await findUserById(userId)
    if (!dbUser) {
      return { status: 404 as const, body: { error: { message: '用户不存在。' } } }
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
    return { status: 200 as const, body: { user: updated } }
  },

  updatePassword: async ({ body }, { viewer, session }) => {
    if (!viewer) {
      return { status: 401 as const, body: { error: { message: '未登录' } } }
    }
    const dbUser = await findUserById(BigInt(viewer.userId))
    if (!dbUser) {
      return { status: 404 as const, body: { error: { message: '用户不存在。' } } }
    }
    const ok = await bcrypt.compare(body.oldPassword, dbUser.password)
    if (!ok) {
      return { status: 403 as const, body: { error: { message: '原密码错误。' } } }
    }
    const hashed = await bcrypt.hash(body.newPassword, 12)
    await updateUserById(dbUser.id, { password: hashed })
    await revokeAllSessionsOfUser(dbUser.id, session.id)
    return { status: 200 as const, body: { success: true } }
  },

  revokeSession: async ({ params }, { viewer, session }) => {
    if (!viewer) {
      return { status: 401 as const, body: { error: { message: '未登录' } } }
    }
    const currentSession = params.id === session.id
    const meta = await findSessionMeta(params.id)
    if (!meta) {
      return { status: 200 as const, body: { success: true, currentSession } }
    }
    if (meta.userId.toString() !== viewer.userId) {
      return { status: 403 as const, body: { error: { message: '无权操作该会话。' } } }
    }
    await revokeSessionById(params.id, meta.userId)
    return { status: 200 as const, body: { success: true, currentSession } }
  },
}
