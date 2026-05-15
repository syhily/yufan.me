import type { ContractImpl } from '@/server/http/ts-rest-adapter'

import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { findSessionMeta, revokeSessionById } from '@/server/auth/sessions'
import { issueResetToken, issueSetupToken, revokeTokensFor } from '@/server/auth/verification-tokens'
import { countAdmins, findUserById, updateUserRole } from '@/server/db/query/user'
import { findUserByEmail, insertAuthor, softDeleteUserById } from '@/server/db/query/user'
import { sendAuthorInvite } from '@/server/email/sender'
import { sendPasswordReset as sendPasswordResetEmail } from '@/server/email/sender'
import { getLogger } from '@/server/logger'
import { tryInviteByEmailRateLimit, tryInviteRateLimit } from '@/server/rate-limit'
import { tryPasswordResetByTargetRateLimit } from '@/server/rate-limit'
import { bulkApproveCommentsForUser } from '@/server/users/service'
import { bulkDeleteCommentsForUser } from '@/server/users/service'
import { fetchAdminUserDto, muteAdminUser } from '@/server/users/service'
import { listUsersForAdmin, toAdminUserDto } from '@/server/users/service'
import { restoreAdminUser } from '@/server/users/service'
import { softDeleteAdminUser } from '@/server/users/service'
import { adminUsersContract } from '@/shared/contracts/admin/users'

export const adminUsersController: ContractImpl<typeof adminUsersContract> = {
  listUsers: async ({ query }) => {
    const result = await listUsersForAdmin(
      query.offset,
      query.limit,
      {
        q: query.q,
        role: query.role ?? 'all',
        includeDeleted: query.includeDeleted ?? false,
        hasPosts: query.hasPosts ?? false,
      },
      query.sortBy ?? 'recent',
    )
    return {
      status: 200 as const,
      body: {
        users: result.users.map(toAdminUserDto),
        total: result.total,
        hasMore: result.hasMore,
      },
    }
  },
  getUser: async ({ params }) => {
    const user = await fetchAdminUserDto(BigInt(params.id))
    if (!user) {
      return { status: 404 as const, body: { error: { message: '用户不存在' } } }
    }
    return { status: 200 as const, body: { user } }
  },
  softDeleteUser: async ({ params }, { viewer }) => {
    const userId = params.id
    if (viewer!.userId === userId) {
      return { status: 403 as const, body: { error: { message: '不能删除自己。' } } }
    }
    const targetId = BigInt(userId)
    const target = await findUserById(targetId)
    if (!target) {
      return { status: 404 as const, body: { error: { message: '用户不存在' } } }
    }
    if (target.role === 'admin') {
      const adminCount = await countAdmins()
      if (adminCount <= 1) {
        return { status: 409 as const, body: { error: { message: '不能删除唯一的管理员。' } } }
      }
    }
    const ok = await softDeleteAdminUser(targetId)
    if (!ok) {
      return { status: 404 as const, body: { error: { message: '用户不存在或已被删除' } } }
    }
    await revokeAllSessionsOfUser(targetId)
    getLogger('audit.user').info('user soft deleted', {
      actor: viewer!.userId,
      target: userId,
      role: target.role,
    })
    return { status: 200 as const, body: { success: true } }
  },
  restoreUser: async ({ params }, { viewer }) => {
    const ok = await restoreAdminUser(BigInt(params.id))
    if (!ok) {
      return { status: 404 as const, body: { error: { message: '用户不存在' } } }
    }
    getLogger('audit.user').info('user restored', { actor: viewer!.userId, target: params.id })
    return { status: 200 as const, body: { success: true } }
  },
  muteUser: async ({ params, body }) => {
    const updated = await muteAdminUser(BigInt(params.id), body.muted)
    if (!updated) {
      return { status: 404 as const, body: { error: { message: '用户不存在或为管理员（管理员不可禁言）' } } }
    }
    const dto = await fetchAdminUserDto(updated.id)
    if (!dto) {
      return { status: 404 as const, body: { error: { message: '用户不存在' } } }
    }
    return { status: 200 as const, body: { user: dto } }
  },
  updateUserRole: async ({ params, body }, { viewer }) => {
    const userId = params.id
    if (viewer!.userId === userId) {
      return { status: 403 as const, body: { error: { message: '不能修改自己的角色。' } } }
    }
    const targetId = BigInt(userId)
    const target = await findUserById(targetId)
    if (!target) {
      return { status: 404 as const, body: { error: { message: '用户不存在。' } } }
    }
    if (target.role === 'admin' && body.role !== 'admin') {
      const adminCount = await countAdmins()
      if (adminCount <= 1) {
        return { status: 409 as const, body: { error: { message: '不能降级唯一的管理员。' } } }
      }
    }
    const updated = await updateUserRole(targetId, body.role)
    if (updated) {
      await revokeAllSessionsOfUser(targetId)
      getLogger('audit.user').info('user role changed', {
        actor: viewer!.userId,
        target: userId,
        from: target.role,
        to: body.role,
      })
    }
    return { status: 200 as const, body: { user: updated } }
  },
  inviteAuthor: async ({ body }, { viewer, clientAddress, request, session }) => {
    const existing = await findUserByEmail(body.email)
    if (existing !== null) {
      return { status: 409 as const, body: { error: { message: '该邮箱已被注册。' } } }
    }
    const ipLimit = await tryInviteRateLimit(clientAddress)
    const emailLimit = await tryInviteByEmailRateLimit(BigInt(viewer!.userId), body.email)
    if (ipLimit.exceeded || emailLimit.exceeded) {
      return { status: 429 as const, body: { error: { message: '邀请发送过于频繁，请稍后再试。' } } }
    }
    const [user] = await insertAuthor(body.name, body.email)
    if (!user) {
      return { status: 500 as const, body: { error: { message: '创建作者账户失败。' } } }
    }
    const { token } = await issueSetupToken(user.id)
    const origin = new URL(request.url).origin
    const link = `${origin}/wp-login.php?action=accept-invite&token=${encodeURIComponent(token)}`
    const inviterSession = session.get('user')
    const inviter = inviterSession?.name ?? '管理员'
    const sendResult = await sendAuthorInvite(user, link, inviter, inviterSession?.email)
    if (!sendResult.ok) {
      await revokeTokensFor(user.id, 'author-invite')
      await softDeleteUserById(user.id)
      getLogger('audit.user').warn('author invite rolled back: email send failed', {
        actor: viewer!.userId,
        target: String(user.id),
        email: body.email,
        reason: sendResult.reason,
        message: sendResult.message,
      })
      return {
        status: 500 as const,
        body: { error: { message: `邮件发送失败，已回滚账户创建：${sendResult.message}` } },
      }
    }
    getLogger('audit.user').info('author invited', {
      actor: viewer!.userId,
      target: String(user.id),
      email: body.email,
    })
    return { status: 200 as const, body: { success: true } }
  },
  sendPasswordReset: async ({ body }, { viewer, request }) => {
    const user = await findUserByEmail(body.email)
    if (!user) {
      return { status: 404 as const, body: { error: { message: '用户不存在。' } } }
    }
    const limit = await tryPasswordResetByTargetRateLimit(user.id)
    if (limit.exceeded) {
      return { status: 429 as const, body: { error: { message: '该用户的重置邮件发送过于频繁，请稍后再试。' } } }
    }
    const { token } = await issueResetToken(user.id)
    const origin = new URL(request.url).origin
    const link = `${origin}/wp-login.php?action=resetpassword&token=${encodeURIComponent(token)}`
    await sendPasswordResetEmail(user, link)
    getLogger('audit.user').info('password reset sent', { actor: viewer!.userId, target: String(user.id) })
    return { status: 200 as const, body: { success: true } }
  },
  revokeSession: async ({ body }, { viewer, session }) => {
    const currentSession = body.sessionId === session.id
    const meta = await findSessionMeta(body.sessionId)
    if (!meta) {
      return { status: 200 as const, body: { success: true, currentSession } }
    }
    await revokeSessionById(body.sessionId, meta.userId)
    getLogger('audit.session').info('session revoked by admin', {
      actor: viewer!.userId,
      target: meta.userId.toString(),
      sessionId: body.sessionId,
      selfRevoke: currentSession,
    })
    return { status: 200 as const, body: { success: true, currentSession } }
  },
  revokeUserSessions: async ({ body }, { viewer }) => {
    let targetId: bigint
    try {
      targetId = BigInt(body.userId)
    } catch {
      return { status: 400 as const, body: { error: { message: '用户 ID 无效。' } } }
    }
    const target = await findUserById(targetId)
    if (!target) {
      return { status: 404 as const, body: { error: { message: '用户不存在' } } }
    }
    await revokeAllSessionsOfUser(targetId)
    getLogger('audit.session').info('all sessions revoked by admin', {
      actor: viewer!.userId,
      target: body.userId,
    })
    return { status: 200 as const, body: { success: true } }
  },
  bulkApproveUserComments: async ({ body }) => {
    const result = await bulkApproveCommentsForUser(BigInt(body.userId))
    return { status: 200 as const, body: result }
  },
  bulkSoftDeleteUserComments: async ({ body }) => {
    const result = await bulkDeleteCommentsForUser(BigInt(body.userId))
    return { status: 200 as const, body: result }
  },
}
