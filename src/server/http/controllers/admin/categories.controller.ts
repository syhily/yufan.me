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
import { body, query, asId, resolveId, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { listPostsByCategory } from '@/server/posts/query'
import { ActionFailure } from '@/server/route-helpers/errors'

interface CategoryListQuery {
  q?: string
}

interface CreateCategoryBody {
  name: string
  slug?: string
  cover: string
  description?: string
  sortOrder?: number
}

interface UpdateCategoryBody {
  name?: string
  slug?: string
  cover?: string
  description?: string
  sortOrder?: number
}

interface ReorderCategoryBody {
  orderedIds: string[]
}

export const adminCategoriesController: ContractImpl<typeof adminCategoriesContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<CategoryListQuery>(args)
    const result = await listCategoriesForAdmin({ q: q.q })
    return ok({ categories: result.categories, total: result.total })
  },

  get: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const row = await findCategoryById(asId(id))
    if (!row) {
      return notFound('分类不存在')
    }
    const posts = await listPostsByCategory(row.name, { includeHidden: true, includeScheduled: true })
    return ok({ category: toAdminCategoryDto(row, posts.length) })
  },

  create: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    try {
      const b = body<CreateCategoryBody>(args)
      const category = await upsertAdminCategory({
        name: b.name,
        slug: b.slug,
        cover: b.cover,
        description: b.description ?? '',
        sortOrder: b.sortOrder ?? 0,
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
    const existing = await findCategoryById(asId(id))
    if (!existing) {
      return notFound('分类不存在')
    }
    try {
      const b = body<UpdateCategoryBody>(args)
      const category = await upsertAdminCategory({
        id: asId(id),
        name: b.name ?? existing.name,
        slug: b.slug,
        cover: b.cover ?? existing.cover,
        description: b.description ?? existing.description,
        sortOrder: b.sortOrder ?? existing.sortOrder,
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
    const deleted = await deleteAdminCategory(asId(id))
    if (!deleted) {
      return notFound('分类不存在')
    }
    return ok({ success: true })
  },

  reorder: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    try {
      const b = body<ReorderCategoryBody>(args)
      const categories = await reorderAdminCategories(b.orderedIds)
      return ok({ categories })
    } catch (e) {
      if (e instanceof ActionFailure) {
        return { status: e.status, body: { error: { message: e.message } } }
      }
      throw e
    }
  },
}
