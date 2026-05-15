import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'

import { deleteAdminTag, listTagsForAdmin, upsertAdminTag } from '@/server/tags/service'
import { adminTagsContract } from '@/shared/contracts/admin/tags'

export const adminTagsController: AuthedContractImpl<typeof adminTagsContract> = {
  list: async (args, _ctx) => {
    const payload = args.query
    const result = await listTagsForAdmin({ q: payload.q, offset: payload.offset, limit: payload.limit })
    return { status: 200 as const, body: result }
  },
  upsert: async (args, ctx) => {
    const payload = args.body
    const tag = await upsertAdminTag(
      {
        id: payload.id !== undefined ? BigInt(payload.id) : undefined,
        name: payload.name,
        slug: payload.slug,
      },
      ctx.viewer ?? undefined,
    )
    return { status: 200 as const, body: { tag } }
  },
  delete: async (args, ctx) => {
    const id = args.params.id
    const ok = await deleteAdminTag(BigInt(id), ctx.viewer ?? undefined)
    if (!ok) {
      return { status: 404 as const, body: { error: { message: '标签不存在' } } }
    }
    return { status: 204 as const, body: undefined }
  },
}
