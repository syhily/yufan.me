import { z } from 'zod'

import { httpUrlOrEmptyStringSchema } from '@/shared/safe-url'

export const commentReplySchema = z.object({
  page_key: z.string(),
  name: z.string(),
  email: z.email(),
  link: httpUrlOrEmptyStringSchema.optional(),
  content: z.string().min(1),
  rid: z.number().optional(),
})
export type CommentReplyInput = z.infer<typeof commentReplySchema>

export const commentRidSchema = z.object({ rid: z.string() })
export type CommentRidInput = z.infer<typeof commentRidSchema>

export const commentEditSchema = z.object({ rid: z.string(), content: z.string().min(1) })
export type CommentEditInput = z.infer<typeof commentEditSchema>

export const loadCommentsSchema = z.object({
  page_key: z.string(),
  offset: z.coerce.number(),
})
export type LoadCommentsInput = z.infer<typeof loadCommentsSchema>

export const loadAllCommentsSchema = z.object({
  offset: z.number().min(0),
  limit: z.number().min(1).max(100),
  pageKey: z.string().optional(),
  userId: z.string().optional(),
  status: z.enum(['all', 'pending', 'approved']).optional(),
})
export type LoadAllCommentsInput = z.infer<typeof loadAllCommentsSchema>
