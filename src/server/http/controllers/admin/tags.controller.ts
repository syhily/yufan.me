import type { adminTagsContract } from '@/shared/contracts/admin/tags'

import { ok, notFound } from '@/server/http/response'
import {
  body,
  query,
  asId,
  requireViewer,
  resolveId,
  type ContractImpl,
  type HandlerContext,
} from '@/server/http/ts-rest-adapter'
import { deleteAdminTag, listTagsForAdmin, upsertAdminTag } from '@/server/tags/service'

interface TagsListQuery {
  q?: string
  offset?: number
  limit?: number
}

interface UpsertTagBody {
  id?: string
  name: string
  slug?: string
}

export const adminTagsController: ContractImpl<typeof adminTagsContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<TagsListQuery>(args)
    const result = await listTagsForAdmin({ q: q.q, offset: q.offset, limit: q.limit })
    return ok({ tags: result.tags, total: result.total, hasMore: result.hasMore })
  },

  upsert: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const b = body<UpsertTagBody>(args)
    const tag = await upsertAdminTag({
      id: b.id !== undefined ? asId(b.id) : undefined,
      name: b.name,
      slug: b.slug,
    })
    return ok({ tag })
  },

  delete: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const deleted = await deleteAdminTag(asId(id), viewer)
    if (!deleted) {
      return notFound('标签不存在')
    }
    return ok({ success: true })
  },
}
