import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors, standardReadErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminImagesContract = c.router(
  {
    listImages: {
      method: 'GET',
      path: '/admin/list-images',
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'listImages',
    },
    deleteImage: {
      method: 'DELETE',
      path: '/admin/delete-image/:id',
      pathParams: idParam,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'deleteImage',
    },
    updateImageNote: {
      method: 'PATCH',
      path: '/admin/update-image-note/:id',
      pathParams: idParam,
      body: z.any() /* TODO: use updateImageNoteSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'updateImageNote',
    },
    recalculateImageThumbhash: {
      method: 'POST',
      path: '/admin/recalculate-image-thumbhash',
      body: z.any() /* TODO: use recalculateThumbhashSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'recalculateImageThumbhash',
    },
    uploadImage: {
      method: 'POST',
      path: '/admin/upload-image',
      body: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'uploadImage',
    },
  },
  { strictStatusCodes: true },
)
