import type { UpdateUserInput } from '@/server/auth-schema'
import type {
  CommentEditInput,
  CommentReplyInput,
  CommentRidInput,
  LoadAllCommentsInput,
} from '@/server/comments/schema'
import type { AdminComment, CommentItem } from '@/server/comments/types'

export type { UpdateUserInput }

export interface UpdateUserOutput {
  success: true
}

export interface IncreaseLikeInput {
  key: string
}

export interface IncreaseLikeOutput {
  key: string
  likes: number
  token: string
}

export interface DecreaseLikeInput {
  key: string
  token: string
}

export interface DecreaseLikeOutput {
  key: string
  likes: number
}

export interface ValidateLikeTokenInput {
  key: string
  token: string
}

export interface ValidateLikeTokenOutput {
  key: string
  valid: boolean
}

export interface FindAvatarInput {
  email: string
}

export interface FindAvatarOutput {
  avatar: string
}

export type { CommentEditInput, CommentReplyInput, CommentRidInput, LoadAllCommentsInput }
export type ReplyCommentInput = CommentReplyInput

export interface LoadCommentsInput {
  page_key: string
  offset: number
}

// Comment endpoints now return raw `CommentItem` / `AdminComment` records
// instead of pre-rendered HTML so the React UI can re-render them through
// the same `<CommentItem />` / `<AdminCommentCard />` components used at SSR
// time. The bigint ids inside these payloads round-trip through React
// Router's turbo-stream serializer, which supports BigInt natively.
export interface ReplyCommentOutput {
  comment: CommentItem
}

export interface CommentEditOutput {
  comment: CommentItem
}

export interface LoadCommentsOutput {
  comments: CommentItem[]
  next: boolean
}

export interface CommentRawOutput {
  content: string
}

export interface FilterOptionsOutput {
  pages: { key: string; title: string | null }[]
  authors: { id: string; name: string }[]
}

export type LoadAllInput = LoadAllCommentsInput

export interface LoadAllOutput {
  comments: AdminComment[]
  total: number
  hasMore: boolean
}
