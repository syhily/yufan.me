import { ORPCError } from '@orpc/server'
import { z } from 'zod'

import { authorProc } from '@/server/http/orpc-base'
import { deleteAdminTag, listTagsForAdmin, upsertAdminTag } from '@/server/taxonomies/tag-service'
import { adminTagDto } from '@/shared/contracts/tags'

const list = authorProc
  .route({ method: 'GET', path: '/admin/tags/list' })
  .input(
    z.object({
      q: z.string().optional(),
      offset: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
    }),
  )
  .output(z.object({ tags: z.array(adminTagDto), total: z.number(), hasMore: z.boolean() }))
  .handler(({ input }) => listTagsForAdmin({ q: input.q, offset: input.offset, limit: input.limit }))

const upsert = authorProc
  .route({ method: 'POST', path: '/admin/tags/upsert' })
  .input(
    z.object({
      id: z.string().min(1).optional(),
      name: z.string().trim().min(1).max(20),
      slug: z.string().optional(),
    }),
  )
  .output(z.object({ tag: adminTagDto }))
  .handler(async ({ input, context }) => {
    const tag = await upsertAdminTag(
      {
        id: input.id !== undefined ? BigInt(input.id) : undefined,
        name: input.name,
        slug: input.slug,
      },
      context.viewer,
    )
    return { tag }
  })

const remove = authorProc
  .route({ method: 'POST', path: '/admin/tags/remove' })
  .input(z.object({ id: z.string().min(1) }))
  .output(z.void())
  .handler(async ({ input, context }) => {
    const ok = await deleteAdminTag(BigInt(input.id), context.viewer)
    if (!ok) {
      throw new ORPCError('NOT_FOUND', { message: '标签不存在' })
    }
  })

export const adminTagsRouter = { list, upsert, delete: remove }
