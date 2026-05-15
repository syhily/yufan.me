import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { adminImageDto, listImagesOutputDto } from '@/shared/contracts/_dtos'
import { errorResponse, standardMutationErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminImagesContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/admin/images',
      query: z.object({
        q: z.string().optional(),
        kind: z.string().optional(),
        offset: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      }),
      responses: { 200: listImagesOutputDto, ...standardMutationErrors },
      summary: '管理后台：图片列表',
    },
    delete: {
      method: 'DELETE',
      path: '/admin/images/:id',
      pathParams: idParam,
      body: c.noBody(),
      responses: { 204: c.noBody(), ...standardMutationErrors },
      summary: '管理后台：删除图片',
    },
    updateNote: {
      method: 'PATCH',
      path: '/admin/images/:id/note',
      pathParams: idParam,
      body: z.object({ note: z.string().nullable().optional() }),
      responses: { 200: z.object({ image: adminImageDto }), ...standardMutationErrors },
      summary: '管理后台：更新图片备注',
    },
    recalculateThumbhash: {
      method: 'POST',
      path: '/admin/images/recalculate-thumbhash',
      body: z.object({ id: z.string().min(1) }),
      responses: { 200: z.object({ image: adminImageDto }), ...standardMutationErrors },
      summary: '管理后台：重算 thumbhash',
    },
    upload: {
      method: 'POST',
      path: '/admin/images/upload',
      contentType: 'multipart/form-data',
      body: z.unknown(),
      responses: { 200: z.object({ image: adminImageDto }), ...standardMutationErrors },
      summary: '管理后台：上传图片',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
