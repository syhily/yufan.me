import { z } from 'zod'

import { c } from '../_base'
import { standardMutationErrors, standardReadErrors } from '../_errors'

const adminImageDto = z.object({
  id: z.string(),
  kind: z.enum(['generic', 'category', 'friend']),
  storagePath: z.string(),
  publicUrl: z.string(),
  mimeType: z.string(),
  width: z.number(),
  height: z.number(),
  byteSize: z.number(),
  thumbhash: z.string().nullable(),
  uploaderId: z.string().nullable(),
  uploaderName: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const adminImagesContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/admin/images',
      query: z.object({
        q: z.string().trim().max(200).optional(),
        kind: z.enum(['generic', 'category', 'friend', 'all']).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        limit: z.coerce.number().int().min(1).max(200).optional(),
      }),
      responses: {
        200: z.object({ images: z.array(adminImageDto), total: z.number(), hasMore: z.boolean() }),
        ...standardReadErrors,
      },
      summary: '管理后台：图片列表',
    },
    upload: {
      method: 'POST',
      path: '/admin/images',
      body: c.noBody(),
      contentType: 'multipart/form-data',
      responses: {
        200: z.object({ image: adminImageDto }),
        ...standardMutationErrors,
      },
      summary: '管理后台：上传图片（multipart/form-data）',
    },
    delete: {
      method: 'DELETE',
      path: '/admin/images/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: z.object({ success: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：删除图片',
    },
    updateNote: {
      method: 'PATCH',
      path: '/admin/images/:id/note',
      pathParams: z.object({ id: z.string().min(1) }),
      body: z.object({
        note: z
          .union([z.string(), z.null()])
          .optional()
          .transform((v) => {
            if (v === undefined || v === null) {
              return null
            }
            const trimmed = v.trim()
            return trimmed === '' ? null : trimmed
          }),
      }),
      responses: {
        200: z.object({ image: adminImageDto }),
        ...standardMutationErrors,
      },
      summary: '管理后台：更新图片备注',
    },
    recalculateThumbhash: {
      method: 'POST',
      path: '/admin/images/:id/recalculate-thumbhash',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: z.object({ image: adminImageDto }),
        ...standardMutationErrors,
      },
      summary: '管理后台：重新计算图片缩略哈希',
    },
  },
  { strictStatusCodes: true },
)
