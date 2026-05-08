import { defineApiAction } from '@/server/route-helpers/api-handler'
import { upsertTagSchema } from '@/server/tags/schema'
import { upsertAdminTag } from '@/server/tags/service'

export const action = defineApiAction({
  method: 'POST',
  input: upsertTagSchema,
  requireAdmin: true,
  async run({ payload }) {
    const tag = await upsertAdminTag({
      id: payload.id !== undefined ? BigInt(payload.id) : undefined,
      name: payload.name,
      slug: payload.slug,
    })
    return { tag }
  },
})
