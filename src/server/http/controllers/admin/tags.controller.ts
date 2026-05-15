import type { ContractImpl } from '@/server/http/ts-rest-adapter'

import { userSession } from '@/server/session'
import { listTagsSchema } from '@/server/tags/schema'
import { tagIdSchema } from '@/server/tags/schema'
import { upsertTagSchema } from '@/server/tags/schema'
import { deleteAdminTag } from '@/server/tags/service'
import { listTagsForAdmin } from '@/server/tags/service'
import { upsertAdminTag } from '@/server/tags/service'
import { adminTagsContract } from '@/shared/contracts/admin/tags'

export const adminTagsController = {
  listTags: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.query
    const result = await listTagsForAdmin({ q: payload.q, offset: payload.offset, limit: payload.limit })
    return { status: 200 as const, body: result }
  },
  upsertTag: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const tag = await upsertAdminTag({
      id: payload.id !== undefined ? BigInt(payload.id) : undefined,
      name: payload.name,
      slug: payload.slug,
    })
    return { status: 200 as const, body: { tag } }
  },
  deleteTag: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const ok = await deleteAdminTag(BigInt(payload.id), ctx.viewer)
    if (!ok) {
      return { status: 404 as const, body: { error: { message: '标签不存在' } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
}
