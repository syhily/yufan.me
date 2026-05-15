import { z } from 'zod'

import {
  listPostsSchema,
  previewPostBodySchema,
  savePostBodySchema,
  upsertPostMetaSchema,
} from '@/server/cms/posts/schema'
import { c } from '@/shared/contracts/_base'
import {
  adminPostDetailDto,
  adminPostDto,
  adminRevisionDto,
  listPostRevisionsOutputDto,
  listPostsOutputDto,
} from '@/shared/contracts/_dtos'
import { errorResponse, standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminPostsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/admin/posts',
      query: listPostsSchema,
      responses: { 200: listPostsOutputDto, ...standardReadErrors },
      summary: '管理后台：文章列表',
    },
    get: {
      method: 'GET',
      path: '/admin/posts/:id',
      pathParams: idParam,
      responses: { 200: adminPostDetailDto, ...standardReadErrors },
      summary: '管理后台：文章详情',
    },
    delete: {
      method: 'DELETE',
      path: '/admin/posts/:id',
      pathParams: idParam,
      body: c.noBody(),
      responses: { 204: c.noBody(), ...standardMutationErrors },
      summary: '管理后台：软删除文章',
    },
    restore: {
      method: 'POST',
      path: '/admin/posts/:id/restore',
      pathParams: idParam,
      body: c.noBody(),
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：恢复已删除文章',
    },
    unpublish: {
      method: 'POST',
      path: '/admin/posts/unpublish',
      body: z.object({ id: z.string().min(1) }),
      responses: { 200: z.object({ post: adminPostDto }), ...standardMutationErrors },
      summary: '管理后台：取消发布文章',
    },
    saveDraft: {
      method: 'POST',
      path: '/admin/posts/draft',
      body: savePostBodySchema,
      responses: {
        200: z.discriminatedUnion('status', [
          z.object({ status: z.literal('saved'), revision: adminRevisionDto }),
          z.object({ status: z.literal('conflict'), latest: adminRevisionDto, expectedToken: z.string() }),
        ]),
        ...standardMutationErrors,
      },
      summary: '管理后台：保存文章草稿',
    },
    publishLatest: {
      method: 'POST',
      path: '/admin/posts/publish',
      body: savePostBodySchema,
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
      path: '/admin/posts/preview',
      body: previewPostBodySchema,
      responses: {
        200: z.object({
          html: z.string(),
          headings: z.array(z.object({ text: z.string(), depth: z.coerce.number(), slug: z.string() })),
        }),
        ...standardMutationErrors,
      },
      summary: '管理后台：预览文章',
    },
    upsertMeta: {
      method: 'POST',
      path: '/admin/posts/meta',
      body: upsertPostMetaSchema,
      responses: { 200: z.object({ post: adminPostDto }), ...standardMutationErrors },
      summary: '管理后台：更新文章元数据',
    },
    listRevisions: {
      method: 'GET',
      path: '/admin/posts/revisions',
      query: z.object({ id: z.string().min(1) }),
      responses: { 200: listPostRevisionsOutputDto, ...standardReadErrors },
      summary: '管理后台：文章修订历史',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
