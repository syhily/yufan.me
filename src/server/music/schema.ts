import { z } from 'zod'

// Zod schemas for the music admin API surface. `source` is a literal
// for now (`'netease'` only) so the wire envelope stays forward-
// compatible with future providers — adding `'tencent'` later means
// widening this union and supplying a matching Meting wrapper.

export const metingSourceSchema = z.literal('netease')

export const listMusicSchema = z.object({
  q: z.string().trim().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const searchMusicSchema = z.object({
  keyword: z.string().trim().min(1, '请输入搜索关键词').max(100),
  limit: z.coerce.number().int().min(1).max(30).optional(),
})

export const addMusicSchema = z.object({
  source: metingSourceSchema,
  sourceId: z.string().trim().min(1).max(64),
})

export const deleteMusicSchema = z.object({
  id: z.string().trim().min(1),
})

export const publicMusicGetSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9]{16}$/, 'invalid player id'),
})

export type ListMusicInput = z.infer<typeof listMusicSchema>
export type SearchMusicInput = z.infer<typeof searchMusicSchema>
export type AddMusicInput = z.infer<typeof addMusicSchema>
export type DeleteMusicInput = z.infer<typeof deleteMusicSchema>
export type PublicMusicGetInput = z.infer<typeof publicMusicGetSchema>
