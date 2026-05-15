import { z } from 'zod'

import { portableTextBodySchema } from '@/shared/pt/schema'

import { c } from '../_base'
import { standardMutationErrors, standardReadErrors } from '../_errors'

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

const adminPageDto = z.object({
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
  showFriends: z.boolean(),
  publishedAt: z.string(),
  publishedRevisionId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  authorId: z.string().nullable(),
  authorName: z.string().nullable(),
  commentCount: z.number(),
  commentPublicId: z.string(),
})

const savePageResult = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), revision: adminRevisionDto }),
  z.object({ status: z.literal('conflict'), latest: adminRevisionDto, expectedToken: z.string() }),
])

export const adminPagesContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/admin/pages',
      query: z.object({
        q: z.string().trim().max(100).optional(),
        deletedStatus: z.enum(['all', 'deleted', 'normal']).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      responses: {
        200: z.object({ pages: z.array(adminPageDto), total: z.number(), hasMore: z.boolean() }),
        ...standardReadErrors,
      },
      summary: '管理后台：页面列表',
    },
    get: {
      method: 'GET',
      path: '/admin/pages/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      responses: {
        200: z.object({
          page: adminPageDto,
          latestRevision: adminRevisionDto.nullable(),
          publishedRevision: adminRevisionDto.nullable(),
        }),
        ...standardReadErrors,
      },
      summary: '管理后台：页面详情',
    },
    upsertMeta: {
      method: 'POST',
      path: '/admin/pages',
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
        showFriends: z.coerce.boolean().optional(),
        publishedAt: z.iso.datetime({ offset: true }).optional(),
      }),
      responses: {
        200: z.object({ page: adminPageDto }),
        ...standardMutationErrors,
      },
      summary: '管理后台：新建 / 更新页面元数据',
    },
    delete: {
      method: 'DELETE',
      path: '/admin/pages/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: z.object({ success: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：删除页面',
    },
    restore: {
      method: 'POST',
      path: '/admin/pages/:id/restore',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: z.object({ success: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：恢复已删除页面',
    },
    listRevisions: {
      method: 'GET',
      path: '/admin/pages/:id/revisions',
      pathParams: z.object({ id: z.string().min(1) }),
      responses: {
        200: z.object({ revisions: z.array(adminRevisionDto) }),
        ...standardReadErrors,
      },
      summary: '管理后台：页面修订历史',
    },
    saveDraft: {
      method: 'POST',
      path: '/admin/pages/:id/drafts',
      pathParams: z.object({ id: z.string().min(1) }),
      body: z.object({
        body: portableTextBodySchema,
        expectedClientRevisionToken: z.uuid().nullable().optional(),
        force: z.coerce.boolean().optional(),
        publishedAt: z.iso.datetime({ offset: true }).optional(),
      }),
      responses: {
        200: savePageResult,
        ...standardMutationErrors,
      },
      summary: '管理后台：保存页面草稿',
    },
    publish: {
      method: 'POST',
      path: '/admin/pages/:id/publish',
      pathParams: z.object({ id: z.string().min(1) }),
      body: z.object({
        body: portableTextBodySchema,
        expectedClientRevisionToken: z.uuid().nullable().optional(),
        force: z.coerce.boolean().optional(),
        publishedAt: z.iso.datetime({ offset: true }).optional(),
      }),
      responses: {
        200: savePageResult,
        ...standardMutationErrors,
      },
      summary: '管理后台：发布页面',
    },
    unpublish: {
      method: 'POST',
      path: '/admin/pages/:id/unpublish',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: z.object({ page: adminPageDto }),
        ...standardMutationErrors,
      },
      summary: '管理后台：下架页面',
    },
    preview: {
      method: 'POST',
      path: '/admin/pages/preview',
      body: z.object({
        body: portableTextBodySchema,
      }),
      responses: {
        200: z.object({
          html: z.string(),
          headings: z.array(z.object({ depth: z.number(), slug: z.string(), text: z.string() })),
        }),
        ...standardMutationErrors,
      },
      summary: '管理后台：预览页面渲染',
    },
  },
  { strictStatusCodes: true },
)
