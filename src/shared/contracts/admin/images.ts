import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { adminImageDto, listImagesOutputDto } from '@/shared/contracts/_dtos'
import { errorResponse, standardMutationErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminImagesContract = c.router(
  {
    listImages: {
      method: 'GET',
      path: '/admin/images',
      query: z.object({
        q: z.string().optional(),
        kind: z.string().optional(),
        offset: z.number().optional(),
        limit: z.number().optional(),
      }),
      responses: { 200: listImagesOutputDto, ...standardMutationErrors },
      summary: 'listImages',
    },
    deleteImage: {
      method: 'DELETE',
      path: '/admin/images/:id',
      pathParams: idParam,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'deleteImage',
    },
    updateImageNote: {
      method: 'PATCH',
      path: '/admin/images/:id/note',
      pathParams: idParam,
      body: z.object({ note: z.string().nullable().optional() }),
      responses: { 200: z.object({ image: adminImageDto }), ...standardMutationErrors },
      summary: 'updateImageNote',
    },
    recalculateImageThumbhash: {
      method: 'POST',
      path: '/admin/images/recalculate-thumbhash',
      body: z.object({ id: z.string().min(1) }),
      responses: { 200: z.object({ image: adminImageDto }), ...standardMutationErrors },
      summary: 'recalculateImageThumbhash',
    },
    uploadImage: {
      method: 'POST',
      path: '/admin/images/upload',
      contentType: 'multipart/form-data',
      body: z.unknown(),
      responses: { 200: z.object({ image: adminImageDto }), ...standardMutationErrors },
      summary: 'uploadImage',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
