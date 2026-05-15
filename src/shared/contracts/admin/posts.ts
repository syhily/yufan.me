import { z } from 'zod'

import { portableTextBodySchema } from '@/shared/pt/schema'

import { c } from '../_base'
import { errorResponse, standardMutationErrors, standardReadErrors } from '../_errors'

const adminRevisionDto = z.object({
  id: z.string(),
  revisionNo: z.number(),
  status: z.enum(['draft', 'published']),
  body: portableTextBodySchema,
  imageSources: z.array(z.string()),
  headings: z.array(z.object({ depth: z.number(), slug: z.string(), text: z.string() })),
  authorId: z.string().nullable(),
  clientRevisionToken: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const adminPostDto = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  cover: z.string(),
  og: z.string().nullable(),
  published: z.boolean(),
  commentsEnabled: z.boolean(),
  showToc: z.boolean(),
  showUpdated: z.boolean(),
  visible: z.boolean(),
  publishedAt: z.string(),
  publishedRevisionId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  category: z.string(),
  tags: z.array(z.string()),
  alias: z.array(z.string()),
  authorId: z.string().nullable(),
  authorName: z.string().nullable(),
  pinnedAt: z.string().nullable(),
  firstPublishedAt: z.string().nullable(),
  commentCount: z.number(),
  commentPublicId: z.string(),
})

const savePostResult = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), revision: adminRevisionDto }),
  z.object({ status: z.literal('conflict'), latest: adminRevisionDto, expectedToken: z.string() }),
])

export const listPostsResponse = z.object({ posts: z.array(adminPostDto), total: z.number(), hasMore: z.boolean() })
export const getPostResponse = z.object({
  post: adminPostDto,
  latestRevision: adminRevisionDto.nullable(),
  publishedRevision: adminRevisionDto.nullable(),
})
export const upsertPostMetaResponse = z.object({ post: adminPostDto })
export const deletePostResponse = z.object({ success: z.boolean() })
export const restorePostResponse = z.object({ success: z.boolean() })
export const listPostRevisionsResponse = z.object({ revisions: z.array(adminRevisionDto) })
export const unpublishPostResponse = z.object({ post: adminPostDto })
export const previewPostResponse = z.object({
  html: z.string(),
  headings: z.array(z.object({ depth: z.number(), slug: z.string(), text: z.string() })),
})

export const adminPostsContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/admin/posts',
      query: z.object({
        q: z.string().trim().max(100).optional(),
        deletedStatus: z.enum(['all', 'deleted', 'normal']).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        category: z.string().trim().max(20).optional(),
        tag: z.string().trim().max(20).optional(),
        published: z
          .union([z.literal('true'), z.literal('false'), z.boolean()])
          .transform((v) => (v === 'true' ? true : v === 'false' ? false : v))
          .optional(),
        visible: z
          .union([z.literal('true'), z.literal('false'), z.boolean()])
          .transform((v) => (v === 'true' ? true : v === 'false' ? false : v))
          .optional(),
        sortBy: z.enum(['publishedAt', 'updatedAt']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        authorId: z.coerce.bigint().optional(),
      }),
      responses: {
        200: listPostsResponse,
        ...standardReadErrors,
      },
      summary: '管理后台：文章列表',
    },
    get: {
      method: 'GET',
      path: '/admin/posts/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      responses: {
        200: getPostResponse,
        ...standardReadErrors,
      },
      summary: '管理后台：文章详情',
    },
    upsertMeta: {
      method: 'POST',
      path: '/admin/posts',
      body: z.object({
        id: z.string().min(1).optional(),
        slug: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/)
          .optional(),
        title: z.string().trim().min(1).max(200),
        summary: z
          .string()
          .trim()
          .max(500)
          .optional()
          .transform((v) => v ?? ''),
        cover: z.string().trim().max(500).optional().default(''),
        og: z
          .string()
          .trim()
          .max(500)
          .nullable()
          .optional()
          .transform((v) => (v === undefined || v === '' ? null : v)),
        published: z.coerce.boolean().optional(),
        commentsEnabled: z.coerce.boolean().optional(),
        showToc: z.coerce.boolean().optional(),
        showUpdated: z.coerce.boolean().optional(),
        visible: z.coerce.boolean().optional(),
        pinnedAt: z.iso.datetime({ offset: true }).nullable().optional(),
        publishedAt: z.iso.datetime({ offset: true }).optional(),
        category: z.string().trim().max(20).optional().default(''),
        tags: z.array(z.string().trim().max(20)).optional().default([]),
        alias: z
          .array(
            z
              .string()
              .trim()
              .max(80)
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          )
          .optional()
          .default([]),
      }),
      responses: {
        200: upsertPostMetaResponse,
        ...standardMutationErrors,
      },
      summary: '管理后台：新建 / 更新文章元数据',
    },
    delete: {
      method: 'DELETE',
      path: '/admin/posts/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: deletePostResponse,
        ...standardMutationErrors,
      },
      summary: '管理后台：删除文章',
    },
    restore: {
      method: 'POST',
      path: '/admin/posts/:id/restore',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: restorePostResponse,
        ...standardMutationErrors,
      },
      summary: '管理后台：恢复已删除文章',
    },
    listRevisions: {
      method: 'GET',
      path: '/admin/posts/:id/revisions',
      pathParams: z.object({ id: z.string().min(1) }),
      responses: {
        200: listPostRevisionsResponse,
        ...standardReadErrors,
      },
      summary: '管理后台：文章修订历史',
    },
    saveDraft: {
      method: 'POST',
      path: '/admin/posts/:id/drafts',
      pathParams: z.object({ id: z.string().min(1) }),
      body: z.object({
        body: portableTextBodySchema,
        expectedClientRevisionToken: z.uuid().nullable().optional(),
        force: z.coerce.boolean().optional(),
        publishedAt: z.iso.datetime({ offset: true }).optional(),
      }),
      responses: {
        200: savePostResult,
        ...standardMutationErrors,
      },
      summary: '管理后台：保存文章草稿',
    },
    publish: {
      method: 'POST',
      path: '/admin/posts/:id/publish',
      pathParams: z.object({ id: z.string().min(1) }),
      body: z.object({
        body: portableTextBodySchema,
        expectedClientRevisionToken: z.uuid().nullable().optional(),
        force: z.coerce.boolean().optional(),
        publishedAt: z.iso.datetime({ offset: true }).optional(),
      }),
      responses: {
        200: savePostResult,
        ...standardMutationErrors,
      },
      summary: '管理后台：发布文章',
    },
    unpublish: {
      method: 'POST',
      path: '/admin/posts/:id/unpublish',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: unpublishPostResponse,
        ...standardMutationErrors,
      },
      summary: '管理后台：下架文章',
    },
    preview: {
      method: 'POST',
      path: '/admin/posts/preview',
      body: z.object({
        body: portableTextBodySchema,
      }),
      responses: {
        200: previewPostResponse,
        ...standardMutationErrors,
      },
      summary: '管理后台：预览文章渲染',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
