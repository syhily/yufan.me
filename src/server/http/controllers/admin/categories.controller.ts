import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'

import {
  deleteAdminCategory,
  listCategoriesForAdmin,
  reorderAdminCategories,
  upsertAdminCategory,
} from '@/server/categories/service'
import { adminCategoriesContract } from '@/shared/contracts/admin/categories'

export const adminCategoriesController: AuthedContractImpl<typeof adminCategoriesContract> = {
  list: async (args, _ctx) => {
    const payload = args.query
    const result = await listCategoriesForAdmin({ q: payload.q })
    return { status: 200 as const, body: result }
  },
  upsert: async (args, _ctx) => {
    const payload = args.body
    const category = await upsertAdminCategory({
      id: payload.id !== undefined ? BigInt(payload.id) : undefined,
      name: payload.name,
      slug: payload.slug,
      cover: payload.cover,
      description: payload.description ?? '',
      sortOrder: payload.sortOrder,
    })
    return { status: 200 as const, body: { category } }
  },
  delete: async (args, _ctx) => {
    const ok = await deleteAdminCategory(BigInt(args.params.id))
    if (!ok) {
      return { status: 404 as const, body: { error: { message: '分类不存在' } } }
    }
    return { status: 204 as const, body: undefined }
  },
  reorder: async (args, _ctx) => {
    const payload = args.body
    const categories = await reorderAdminCategories(payload.orderedIds)
    return { status: 200 as const, body: { categories } }
  },
}
