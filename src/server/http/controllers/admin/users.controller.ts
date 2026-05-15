import type { UserSortOrder } from '@/server/users/schema'
import type { adminUsersContract } from '@/shared/contracts/admin/users'

import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { findSessionMeta, revokeSessionById } from '@/server/auth/sessions'
import { countAdmins, findUserById, updateUserRole, type UserRoleFilter } from '@/server/db/query/user'
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
    return {
      status: 200,
      body: { users: result.users.map(toAdminUserDto), total: result.total, hasMore: result.hasMore },
    }
  },

  get: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const user = await fetchAdminUserDto(BigInt(id))
    if (!user) {
      return { status: 404, body: { error: { message: '用户不存在' } } }
    }
    return { status: 200, body: { user } }
  },

  mute: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const body = args.body as { muted: boolean }
    const updated = await muteAdminUser(BigInt(id), body.muted)
    if (!updated) {
      return { status: 404, body: { error: { message: '用户不存在或为管理员（管理员不可禁言）' } } }
    }
    const dto = await fetchAdminUserDto(updated.id)
    if (!dto) {
      return { status: 404, body: { error: { message: '用户不存在' } } }
    }
    return { status: 200, body: { user: dto } }
  },

  updateRole: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const body = args.body as { role: 'admin' | 'author' | 'visitor' }
    if (viewer.userId === id) {
      return { status: 403, body: { error: { message: '不能修改自己的角色。' } } }
    }
    const targetId = BigInt(id)
    const target = await findUserById(targetId)
    if (!target) {
      return { status: 404, body: { error: { message: '用户不存在。' } } }
    }
    if (target.role === 'admin' && body.role !== 'admin') {
      const adminCount = await countAdmins()
      if (adminCount <= 1) {
        return { status: 409, body: { error: { message: '不能降级唯一的管理员。' } } }
      }
    }
    const updated = await updateUserRole(targetId, body.role)
    if (updated) {
      await revokeAllSessionsOfUser(targetId)
      log.info('user role changed', { actor: viewer.userId, target: id, from: target.role, to: body.role })
    }
    return { status: 200, body: { user: updated! } }
  },

  softDelete: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    if (viewer.userId === id) {
      return { status: 403, body: { error: { message: '不能删除自己。' } } }
    }
    const targetId = BigInt(id)
    const target = await findUserById(targetId)
    if (!target) {
      return { status: 404, body: { error: { message: '用户不存在' } } }
    }
    if (target.role === 'admin') {
      const adminCount = await countAdmins()
      if (adminCount <= 1) {
        return { status: 409, body: { error: { message: '不能删除唯一的管理员。' } } }
      }
    }
    const ok = await softDeleteAdminUser(targetId)
    if (!ok) {
      return { status: 404, body: { error: { message: '用户不存在或已被删除' } } }
    }
    await revokeAllSessionsOfUser(targetId)
    log.info('user soft deleted', { actor: viewer.userId, target: id, role: target.role })
    return { status: 200, body: { success: true } }
  },

  restore: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const ok = await restoreAdminUser(BigInt(id))
    if (!ok) {
      return { status: 404, body: { error: { message: '用户不存在' } } }
    }
    log.info('user restored', { actor: viewer.userId, target: id })
    return { status: 200, body: { success: true } }
  },

  revokeSession: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const body = args.body as { sessionId: string }
    const currentSession = body.sessionId === ctx.session.id
    const meta = await findSessionMeta(body.sessionId)
    if (!meta) {
      return { status: 200, body: { success: true, currentSession } }
    }
    await revokeSessionById(body.sessionId, meta.userId)
    log.info('session revoked by admin', {
      actor: viewer.userId,
      target: meta.userId.toString(),
      sessionId: body.sessionId,
      selfRevoke: currentSession,
    })
    return { status: 200, body: { success: true, currentSession } }
  },

  revokeAllSessions: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const targetId = BigInt(id)
    const target = await findUserById(targetId)
    if (!target) {
      return { status: 404, body: { error: { message: '用户不存在。' } } }
    }
    await revokeAllSessionsOfUser(targetId)
    log.info('all sessions revoked by admin', { actor: viewer.userId, target: id })
    return { status: 200, body: { success: true } }
  },
}
