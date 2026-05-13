import { reorderCategoriesSchema } from '@/server/categories/schema'
import { reorderAdminCategories } from '@/server/categories/service'
import { defineApiAction } from '@/server/route-helpers/api-handler'

export const action = defineApiAction({
  method: 'POST',
  input: reorderCategoriesSchema,
  requireRole: 'admin',
  async run({ payload }) {
    const categories = await reorderAdminCategories(payload.orderedIds)
    // Invalidate the in-process catalog so the next public render
    // reflects the new ordering on `/categories` and the home/archive
    // dropdowns without waiting for the next process restart.
    return { categories }
  },
})
