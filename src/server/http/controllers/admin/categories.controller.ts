import type { adminCategoriesContract } from '@/shared/contracts/admin/categories'

import {
  deleteAdminCategory,
  listCategoriesForAdmin,
  reorderAdminCategories,
  toAdminCategoryDto,
  upsertAdminCategory,
} from '@/server/categories/service'
import { findCategoryById } from '@/server/db/query/category'
import { type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { listPostsByCategory } from '@/server/posts/query'
import { ActionFailure } from '@/server/route-helpers/errors'

export const adminCategoriesController: ContractImpl<typeof adminCategoriesContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = args.query as { q?: string }
    const result = await listCategoriesForAdmin({ q: q.q })
    return { status: 200, body: { categories: result.categories, total: result.total } }
  },

  get: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const { id } = args.params as { id: string }
    const row = await findCategoryById(BigInt(id))
    if (!row) {
      return { status: 404, body: { error: { message: '分类不存在' } } }
    }
    const posts = await listPostsByCategory(row.name, { includeHidden: true, includeScheduled: true })
    return { status: 200, body: { category: toAdminCategoryDto(row, posts.length) } }
  },

  create: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    try {
      const body = args.body as {
        name: string
        slug?: string
        cover: string
        description?: string
        sortOrder?: number
      }
      const category = await upsertAdminCategory({
        name: body.name,
        slug: body.slug,
        cover: body.cover,
        description: body.description ?? '',
        sortOrder: body.sortOrder ?? 0,
      })
      return { status: 200, body: { category } }
    } catch (e) {
      if (e instanceof ActionFailure) {
        return { status: e.status, body: { error: { message: e.message } } }
      }
      throw e
    }
  },

  update: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const { id } = args.params as { id: string }
    const existing = await findCategoryById(BigInt(id))
    if (!existing) {
      return { status: 404, body: { error: { message: '分类不存在' } } }
    }
    try {
      const body = args.body as {
        name?: string
        slug?: string
        cover?: string
        description?: string
        sortOrder?: number
      }
      const category = await upsertAdminCategory({
        id: BigInt(id),
        name: body.name ?? existing.name,
        slug: body.slug,
        cover: body.cover ?? existing.cover,
        description: body.description ?? existing.description,
        sortOrder: body.sortOrder ?? existing.sortOrder,
      })
      return { status: 200, body: { category } }
    } catch (e) {
      if (e instanceof ActionFailure) {
        return { status: e.status, body: { error: { message: e.message } } }
      }
      throw e
    }
  },

  delete: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const { id } = args.params as { id: string }
    const ok = await deleteAdminCategory(BigInt(id))
    if (!ok) {
      return { status: 404, body: { error: { message: '分类不存在' } } }
    }
    return { status: 200, body: { success: true } }
  },

  reorder: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    try {
      const body = args.body as { orderedIds: string[] }
      const categories = await reorderAdminCategories(body.orderedIds)
      return { status: 200, body: { categories } }
    } catch (e) {
      if (e instanceof ActionFailure) {
        return { status: e.status, body: { error: { message: e.message } } }
      }
      throw e
    }
  },
}
