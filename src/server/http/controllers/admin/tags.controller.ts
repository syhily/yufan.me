import type { adminTagsContract } from '@/shared/contracts/admin/tags'

import { requireViewer, resolveId, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { deleteAdminTag, listTagsForAdmin, upsertAdminTag } from '@/server/tags/service'

export const adminTagsController: ContractImpl<typeof adminTagsContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = args.query as { q?: string; offset?: number; limit?: number }
    const result = await listTagsForAdmin({ q: q.q, offset: q.offset, limit: q.limit })
    return { status: 200, body: { tags: result.tags, total: result.total, hasMore: result.hasMore } }
  },

  upsert: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const body = args.body as { id?: string; name: string; slug?: string }
    const tag = await upsertAdminTag({
      id: body.id !== undefined ? BigInt(body.id) : undefined,
      name: body.name,
      slug: body.slug,
    })
    return { status: 200, body: { tag } }
  },

  delete: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const ok = await deleteAdminTag(BigInt(id), viewer)
    if (!ok) {
      return { status: 404, body: { error: { message: '标签不存在' } } }
    }
    return { status: 200, body: { success: true } }
  },
}
