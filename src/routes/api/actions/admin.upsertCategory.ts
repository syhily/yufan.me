import { upsertCategorySchema } from '@/server/categories/schema'
import { upsertAdminCategory } from '@/server/categories/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: upsertCategorySchema,
  requireAdmin: true,
  async run({ payload }) {
    const category = await upsertAdminCategory({
      id: payload.id !== undefined ? BigInt(payload.id) : undefined,
      name: payload.name,
      slug: payload.slug,
      cover: payload.cover,
      description: payload.description,
      sortOrder: payload.sortOrder,
    })
    // Invalidate the in-process catalog so the very next public render
    // (and the thumbhash hydration that piggybacks on it) sees the
    // fresh row instead of the stale snapshot from process start.
    return { category }
  },
})
