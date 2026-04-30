import { z } from 'zod'

import { httpUrlOrEmptyStringSchema } from '@/shared/safe-url'

/** Honeypot field: must stay empty (bots often fill every text input). */
const COMMENT_HONEYPOT_MAX_LEN = 240
const COMMENT_CONTENT_MAX_LEN = 12_000
const COMMENT_MAX_HTTP_URLS = 3

function countHttpUrls(text: string): number {
  return (text.match(/https?:\/\//gi) ?? []).length
}

// `rid` arrives either as `number` (legacy JSON callers) or `string`
// (`<fetcher.Form>` submissions, where every field is form-encoded). We
// coerce to a number and treat the special value `0` as "top-level reply",
// which then gets normalised to `undefined` for `createComment`.
export const commentReplySchema = z
  .object({
    page_key: z.string(),
    name: z.string(),
    email: z.email(),
    link: httpUrlOrEmptyStringSchema.optional(),
    content: z.string().min(1).max(COMMENT_CONTENT_MAX_LEN),
    /** Double-submit token; must match the `csrf-token` HttpOnly cookie. */
    csrf: z.string().min(1),
    rid: z.coerce.number().optional(),
    /** Leave blank — used for bot filtering only; stripped before `createComment`. */
    subtitle: z.string().max(COMMENT_HONEYPOT_MAX_LEN).optional().default(''),
  })
  .superRefine((val, ctx) => {
    if (val.subtitle.trim().length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: '输入数据无效。',
        path: ['subtitle'],
      })
    }
    const urls = countHttpUrls(val.content)
    if (urls > COMMENT_MAX_HTTP_URLS) {
      ctx.addIssue({
        code: 'custom',
        message: `留言中链接过多（最多 ${COMMENT_MAX_HTTP_URLS} 个）。`,
        path: ['content'],
      })
    }
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
