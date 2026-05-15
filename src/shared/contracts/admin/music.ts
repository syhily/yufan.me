import { z } from 'zod'

import type { AddMusicOutput, ListMusicOutput, SearchMusicOutput, UpdateMusicOutput } from '@/shared/music'

import { c } from '@/shared/contracts/_base'
import { standardMutationErrors } from '@/shared/contracts/_errors'

const idParam = z.object({ id: z.string().min(1) })

export const adminMusicContract = c.router(
  {
    listMusic: {
      method: 'GET',
      path: '/admin/musics',
      query: z.object({ q: z.string().optional(), offset: z.number().optional(), limit: z.number().optional() }),
      responses: { 200: z.custom<ListMusicOutput>(), ...standardMutationErrors },
      summary: 'listMusic',
    },
    searchMusic: {
      method: 'GET',
      path: '/admin/musics/search',
      query: z.object({ keyword: z.string(), limit: z.number().optional() }),
      responses: { 200: z.custom<SearchMusicOutput>(), ...standardMutationErrors },
      summary: 'searchMusic',
    },
    addMusic: {
      method: 'POST',
      path: '/admin/musics',
      body: z.object({ source: z.literal('netease'), sourceId: z.string().trim().min(1).max(64) }),
      responses: { 200: z.custom<AddMusicOutput>(), ...standardMutationErrors },
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
      responses: { 200: z.custom<UpdateMusicOutput>(), ...standardMutationErrors },
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
  { strictStatusCodes: true },
)
