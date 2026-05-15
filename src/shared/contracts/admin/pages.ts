import { z } from 'zod'

import { listPagesSchema, savePageBodySchema, upsertPageMetaSchema } from '@/server/cms/pages/schema'
import { c } from '@/shared/contracts/_base'
import {
  adminPageDetailDto,
  adminPageDto,
  adminRevisionDto,
  listPageRevisionsOutputDto,
  listPagesOutputDto,
} from '@/shared/contracts/_dtos'
import { errorResponse, standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'
import { portableTextBodySchema } from '@/shared/pt/schema'

const idParam = z.object({ id: z.string().min(1) })

export const adminPagesContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/admin/pages',
      query: listPagesSchema,
      responses: { 200: listPagesOutputDto, ...standardReadErrors },
      summary: '管理后台：页面列表',
    },
    get: {
      method: 'GET',
      path: '/admin/pages/:id',
      pathParams: idParam,
      responses: { 200: adminPageDetailDto, ...standardReadErrors },
      summary: '管理后台：页面详情',
    },
    delete: {
      method: 'DELETE',
      path: '/admin/pages/:id',
      pathParams: idParam,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：软删除页面',
    },
    restore: {
      method: 'POST',
      path: '/admin/pages/:id/restore',
      pathParams: idParam,
      body: c.noBody(),
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：恢复已删除页面',
    },
    unpublish: {
      method: 'POST',
      path: '/admin/pages/unpublish',
      body: z.object({ id: z.string().min(1) }),
      responses: { 200: z.object({ page: adminPageDto }), ...standardMutationErrors },
      summary: '管理后台：取消发布页面',
    },
    saveDraft: {
      method: 'POST',
      path: '/admin/pages/draft',
      body: savePageBodySchema,
      responses: {
        200: z.discriminatedUnion('status', [
          z.object({ status: z.literal('saved'), revision: adminRevisionDto }),
          z.object({ status: z.literal('conflict'), latest: adminRevisionDto, expectedToken: z.string() }),
        ]),
        ...standardMutationErrors,
      },
      summary: '管理后台：保存页面草稿',
    },
    publishLatest: {
      method: 'POST',
      path: '/admin/pages/publish',
      body: savePageBodySchema,
      responses: {
        200: z.discriminatedUnion('status', [
          z.object({ status: z.literal('saved'), revision: adminRevisionDto }),
          z.object({ status: z.literal('conflict'), latest: adminRevisionDto, expectedToken: z.string() }),
        ]),
        ...standardMutationErrors,
      },
      summary: '管理后台：发布最新草稿',
    },
    preview: {
      method: 'POST',
      path: '/admin/pages/preview',
      body: z.object({ body: portableTextBodySchema }),
      responses: {
        200: z.object({
          html: z.string(),
          headings: z.array(z.object({ text: z.string(), depth: z.number(), slug: z.string() })),
        }),
        ...standardMutationErrors,
      },
      summary: '管理后台：预览页面',
    },
    upsertMeta: {
      method: 'POST',
      path: '/admin/pages/meta',
      body: upsertPageMetaSchema,
      responses: { 200: z.object({ page: adminPageDto }), ...standardMutationErrors },
      summary: '管理后台：更新页面元数据',
    },
    listRevisions: {
      method: 'GET',
      path: '/admin/pages/revisions',
      query: z.object({ id: z.string().min(1) }),
      responses: { 200: listPageRevisionsOutputDto, ...standardReadErrors },
      summary: '管理后台：页面修订历史',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
