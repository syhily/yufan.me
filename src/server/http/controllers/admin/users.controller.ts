import type { UserSortOrder } from '@/server/users/schema'
import type { adminUsersContract } from '@/shared/contracts/admin/users'

import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { findSessionMeta, revokeSessionById } from '@/server/auth/sessions'
import { issueResetToken, issueSetupToken } from '@/server/auth/verification-tokens'
import { countAdmins, findUserById, insertAuthor, updateUserRole, type UserRoleFilter } from '@/server/db/query/user'
import { sendAuthorInvite, sendPasswordReset } from '@/server/email/sender'
import { badRequest, conflict, forbidden, notFound, ok } from '@/server/http/response'
import { requireViewer, resolveId, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { getLogger } from '@/server/logger'
import {
  fetchAdminUserDto,
  listUsersForAdmin,
  muteAdminUser,
  restoreAdminUser,
  softDeleteAdminUser,
  toAdminUserDto,
} from '@/server/users/service'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { joinUrl } from '@/shared/urls'

const log = getLogger('audit.user')

export const adminUsersController: ContractImpl<typeof adminUsersContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = args.query as {
      offset?: number
      limit?: number
      q?: string
      role?: string
      includeDeleted?: boolean
      sortBy?: string
      hasPosts?: boolean
    }
    const result = await listUsersForAdmin(
      q.offset ?? 0,
      q.limit ?? 20,
      {
        q: q.q,
        role: (q.role ?? 'all') as UserRoleFilter,
        includeDeleted: q.includeDeleted ?? false,
        hasPosts: q.hasPosts ?? false,
      },
      (q.sortBy ?? 'recent') as UserSortOrder,
    )
    return ok({ users: result.users.map(toAdminUserDto), total: result.total, hasMore: result.hasMore })
  },

  get: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const user = await fetchAdminUserDto(BigInt(id))
    return user ? ok({ user }) : notFound('用户不存在')
  },

  mute: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const body = args.body as { muted: boolean }
    const updated = await muteAdminUser(BigInt(id), body.muted)
    if (!updated) {
      return notFound('用户不存在或为管理员（管理员不可禁言）')
    }
    const dto = await fetchAdminUserDto(updated.id)
    if (!dto) {
      return notFound('用户不存在')
    }
    return ok({ user: dto })
  },

  updateRole: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const body = args.body as { role: 'admin' | 'author' | 'visitor' }
    if (viewer.userId === id) {
      return forbidden('不能修改自己的角色。')
    }
    const targetId = BigInt(id)
    const target = await findUserById(targetId)
    if (!target) {
      return notFound('用户不存在。')
    }
    if (target.role === 'admin' && body.role !== 'admin') {
      const adminCount = await countAdmins()
      if (adminCount <= 1) {
        return conflict('不能降级唯一的管理员。')
      }
    }
    const updated = await updateUserRole(targetId, body.role)
    if (updated) {
      await revokeAllSessionsOfUser(targetId)
      log.info('user role changed', { actor: viewer.userId, target: id, from: target.role, to: body.role })
    }
    return ok({ user: updated! })
  },

  softDelete: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    if (viewer.userId === id) {
      return forbidden('不能删除自己。')
    }
    const targetId = BigInt(id)
    const target = await findUserById(targetId)
    if (!target) {
      return notFound('用户不存在')
    }
    if (target.role === 'admin' && (await countAdmins()) <= 1) {
      return conflict('不能删除唯一的管理员。')
    }
    const ok_ = await softDeleteAdminUser(targetId)
    if (!ok_) {
      return notFound('用户不存在或已被删除')
    }
    await revokeAllSessionsOfUser(targetId)
    log.info('user soft deleted', { actor: viewer.userId, target: id, role: target.role })
    return ok({ success: true })
  },

  restore: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const ok_ = await restoreAdminUser(BigInt(id))
    if (!ok_) {
      return notFound('用户不存在')
    }
    log.info('user restored', { actor: viewer.userId, target: id })
    return ok({ success: true })
  },

  revokeSession: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const body = args.body as { sessionId: string }
    const currentSession = body.sessionId === ctx.session.id
    const meta = await findSessionMeta(body.sessionId)
    if (!meta) {
      return ok({ success: true, currentSession })
    }
    await revokeSessionById(body.sessionId, meta.userId)
    log.info('session revoked by admin', {
      actor: viewer.userId,
      target: meta.userId.toString(),
      sessionId: body.sessionId,
      selfRevoke: currentSession,
    })
    return ok({ success: true, currentSession })
  },

  revokeAllSessions: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const targetId = BigInt(id)
    const target = await findUserById(targetId)
    if (!target) {
      return notFound('用户不存在。')
    }
    await revokeAllSessionsOfUser(targetId)
    log.info('all sessions revoked by admin', { actor: viewer.userId, target: id })
    return ok({ success: true })
  },

  inviteAuthor: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const body = args.body as { name: string; email: string }
    const users = await insertAuthor(body.name, body.email)
    if (users.length === 0) {
      return badRequest('创建用户失败')
    }
    const newUser = users[0]
    const tokenResult = await issueSetupToken(newUser.id)
    const website = requireBlogSettingsSection('siteIdentity').website
    const inviteLink = joinUrl(website, `/wp-admin/accept-invite?token=${encodeURIComponent(tokenResult.token)}`)
    const viewerUser = await findUserById(BigInt(viewer.userId))
    const inviterName = viewerUser?.name ?? '管理员'
    await sendAuthorInvite(newUser, inviteLink, inviterName)
    log.info('author invited', { actor: viewer.userId, target: String(newUser.id), email: body.email })
    return ok({ success: true })
  },

  sendPasswordReset: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    requireViewer(ctx)
    const body = args.body as { userId: string }
    const targetId = BigInt(body.userId)
    const target = await findUserById(targetId)
    if (!target) {
      return notFound('用户不存在')
    }
    const tokenResult = await issueResetToken(targetId)
    const website = requireBlogSettingsSection('siteIdentity').website
    const resetLink = joinUrl(website, `/wp-admin/reset-password?token=${encodeURIComponent(tokenResult.token)}`)
    await sendPasswordReset(target, resetLink)
    log.info('password reset sent', { actor: ctx.viewer?.userId, target: body.userId })
    return ok({ success: true })
  },
}
