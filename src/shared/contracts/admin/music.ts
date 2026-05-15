import { z } from 'zod'

import { c } from '../_base'
import { errorResponse, standardMutationErrors, standardReadErrors } from '../_errors'

const adminMusicDto = z.object({
  id: z.string(),
  source: z.literal('netease'),
  sourceId: z.string(),
  playerId: z.string(),
  name: z.string(),
  artist: z.array(z.string()),
  album: z.string(),
  audioStoragePath: z.string(),
  audioUrl: z.string(),
  coverStoragePath: z.string(),
  coverUrl: z.string(),
  lyric: z.string().nullable(),
  uploaderId: z.string().nullable(),
  uploaderName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const metingSearchHitDto = z.object({
  source: z.literal('netease'),
  sourceId: z.string(),
  name: z.string(),
  artist: z.array(z.string()),
  album: z.string(),
  coverUrl: z.string(),
  previewUrl: z.string(),
})

export const adminMusicContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/admin/music',
      query: z.object({
        q: z.string().trim().max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      responses: {
        200: z.object({ musics: z.array(adminMusicDto), total: z.number(), hasMore: z.boolean() }),
        ...standardReadErrors,
      },
      summary: '管理后台：音乐列表',
    },
    search: {
      method: 'GET',
      path: '/admin/music/search',
      query: z.object({
        keyword: z.string().trim().min(1).max(100),
        limit: z.coerce.number().int().min(1).max(30).optional(),
      }),
      responses: {
        200: z.object({ results: z.array(metingSearchHitDto) }),
        ...standardReadErrors,
      },
      summary: '管理后台：搜索音乐',
    },
    add: {
      method: 'POST',
      path: '/admin/music',
      body: z.object({
        source: z.literal('netease'),
        sourceId: z.string().trim().min(1).max(64),
      }),
      responses: {
        200: z.object({ music: adminMusicDto }),
        ...standardMutationErrors,
      },
      summary: '管理后台：添加音乐',
    },
    update: {
      method: 'PATCH',
      path: '/admin/music/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      body: z.object({
        name: z.string().trim().min(1).max(200),
        artist: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
        album: z.string().trim().max(200).optional().default(''),
        lyric: z
          .string()
          .max(50_000)
          .optional()
          .transform((v) => (v === undefined || v.trim() === '' ? null : v)),
      }),
      responses: {
        200: z.object({ music: adminMusicDto }),
        ...standardMutationErrors,
      },
      summary: '管理后台：更新音乐元数据',
    },
    delete: {
      method: 'DELETE',
      path: '/admin/music/:id',
      pathParams: z.object({ id: z.string().min(1) }),
      body: c.noBody(),
      responses: {
        200: z.object({ success: z.boolean() }),
        ...standardMutationErrors,
      },
      summary: '管理后台：删除音乐',
    },
  },
  { strictStatusCodes: true, commonResponses: { 500: errorResponse } },
)
