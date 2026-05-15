import { z } from 'zod'

import { c } from '@/shared/contracts/_base'
import {
  addMusicOutputDto,
  listMusicOutputDto,
  searchMusicOutputDto,
  updateMusicOutputDto,
} from '@/shared/contracts/_dtos'
import { errorResponse, standardMutationErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminMusicContract = c.router(
  {
    listMusic: {
      method: 'GET',
      path: '/admin/musics',
      query: z.object({
        q: z.string().optional(),
        offset: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      }),
      responses: { 200: listMusicOutputDto, ...standardMutationErrors },
      summary: 'listMusic',
    },
    searchMusic: {
      method: 'GET',
      path: '/admin/musics/search',
      query: z.object({ keyword: z.string(), limit: z.coerce.number().optional() }),
      responses: { 200: searchMusicOutputDto, ...standardMutationErrors },
      summary: 'searchMusic',
    },
    addMusic: {
      method: 'POST',
      path: '/admin/musics',
      body: z.object({ source: z.literal('netease'), sourceId: z.string().trim().min(1).max(64) }),
      responses: { 200: addMusicOutputDto, ...standardMutationErrors },
      summary: 'addMusic',
    },
    updateMusic: {
      method: 'PATCH',
      path: '/admin/musics/:id',
      pathParams: idParam,
      body: z.object({
        name: z.string().trim().min(1).max(200),
        artist: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
        album: z.string().trim().max(200).optional().default(''),
        lyric: z.string().max(50_000).optional(),
      }),
      responses: { 200: updateMusicOutputDto, ...standardMutationErrors },
      summary: 'updateMusic',
    },
    deleteMusic: {
      method: 'DELETE',
      path: '/admin/musics/:id',
      pathParams: idParam,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: 'deleteMusic',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
