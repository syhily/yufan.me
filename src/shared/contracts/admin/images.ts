import { z } from 'zod'

import type { AdminImageDto, ListImagesOutput } from '@/shared/images'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors } from '@/shared/contracts/_errors'

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
      responses: { 200: z.custom<ListImagesOutput>(), ...standardMutationErrors },
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
      responses: { 200: z.object({ image: z.custom<AdminImageDto>() }), ...standardMutationErrors },
      summary: 'updateImageNote',
    },
    recalculateImageThumbhash: {
      method: 'POST',
      path: '/admin/images/recalculate-thumbhash',
      body: z.object({ id: z.string().min(1) }),
      responses: { 200: z.object({ image: z.custom<AdminImageDto>() }), ...standardMutationErrors },
      summary: 'recalculateImageThumbhash',
    },
    uploadImage: {
      method: 'POST',
      path: '/admin/images/upload',
      contentType: 'multipart/form-data',
      body: z.unknown(),
      responses: { 200: z.object({ image: z.custom<AdminImageDto>() }), ...standardMutationErrors },
      summary: 'uploadImage',
    },
  },
  { strictStatusCodes: true },
)
