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
    list: {
      method: 'GET',
      path: '/admin/musics',
      query: z.object({
        q: z.string().optional(),
        offset: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      }),
      responses: { 200: listMusicOutputDto, ...standardMutationErrors },
      summary: '管理后台：音乐列表',
    },
    search: {
      method: 'GET',
      path: '/admin/musics/search',
      query: z.object({ keyword: z.string(), limit: z.coerce.number().optional() }),
      responses: { 200: searchMusicOutputDto, ...standardMutationErrors },
      summary: '管理后台：搜索上游音乐',
    },
    add: {
      method: 'POST',
      path: '/admin/musics',
      body: z.object({ source: z.literal('netease'), sourceId: z.string().trim().min(1).max(64) }),
      responses: { 200: addMusicOutputDto, ...standardMutationErrors },
      summary: '管理后台：导入音乐',
    },
    update: {
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
      summary: '管理后台：更新音乐元数据',
    },
    delete: {
      method: 'DELETE',
      path: '/admin/musics/:id',
      pathParams: idParam,
      responses: { 200: z.object({ success: z.boolean() }), ...standardMutationErrors },
      summary: '管理后台：删除音乐',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
