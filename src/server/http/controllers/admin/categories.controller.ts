import type { adminCategoriesContract } from '@/shared/contracts/admin/categories'

import {
  deleteAdminCategory,
  listCategoriesForAdmin,
  reorderAdminCategories,
  toAdminCategoryDto,
  upsertAdminCategory,
} from '@/server/categories/service'
import { findCategoryById } from '@/server/db/query/category'
import { ok, notFound } from '@/server/http/response'
import { resolveId, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { listPostsByCategory } from '@/server/posts/query'
import { ActionFailure } from '@/server/route-helpers/errors'

export const adminCategoriesController: ContractImpl<typeof adminCategoriesContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = args.query as { q?: string }
    const result = await listCategoriesForAdmin({ q: q.q })
    return ok({ categories: result.categories, total: result.total })
  },

  get: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const row = await findCategoryById(BigInt(id))
    if (!row) {
      return notFound('分类不存在')
    }
    const posts = await listPostsByCategory(row.name, { includeHidden: true, includeScheduled: true })
    return ok({ category: toAdminCategoryDto(row, posts.length) })
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
      return ok({ category })
    } catch (e) {
      if (e instanceof ActionFailure) {
        return { status: e.status, body: { error: { message: e.message } } }
      }
      throw e
    }
  },

  update: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const existing = await findCategoryById(BigInt(id))
    if (!existing) {
      return notFound('分类不存在')
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
      return ok({ category })
    } catch (e) {
      if (e instanceof ActionFailure) {
        return { status: e.status, body: { error: { message: e.message } } }
      }
      throw e
    }
  },

  delete: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const deleted = await deleteAdminCategory(BigInt(id))
    if (!deleted) {
      return notFound('分类不存在')
    }
    return ok({ success: true })
  },

  reorder: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    try {
      const body = args.body as { orderedIds: string[] }
      const categories = await reorderAdminCategories(body.orderedIds)
      return ok({ categories })
    } catch (e) {
      if (e instanceof ActionFailure) {
        return { status: e.status, body: { error: { message: e.message } } }
      }
      throw e
    }
  },
}
