import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminMusicContract = c.router(
  {
    listMusic: {
      method: 'GET',
      path: '/admin/list-music',
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'listMusic',
    },
    searchMusic: {
      method: 'GET',
      path: '/admin/search-music',
      query: z.any(),
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'searchMusic',
    },
    addMusic: {
      method: 'POST',
      path: '/admin/add-music',
      body: z.any() /* TODO: use addMusicSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'addMusic',
    },
    updateMusic: {
      method: 'PATCH',
      path: '/admin/update-music/:id',
      pathParams: idParam,
      body: z.any() /* TODO: use updateMusicSchema */,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'updateMusic',
    },
    deleteMusic: {
      method: 'DELETE',
      path: '/admin/delete-music/:id',
      pathParams: idParam,
      responses: { 200: z.any(), ...standardMutationErrors },
      summary: 'deleteMusic',
    },
  },
  { strictStatusCodes: true },
)
