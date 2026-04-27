import type { UpdateUserInput } from '@/server/auth-schema'
import type {
  CommentEditInput,
  CommentReplyInput,
  CommentRidInput,
  LoadAllCommentsInput,
} from '@/server/comments/schema'
import type { AdminComment, CommentItem, LatestComment } from '@/server/comments/types'

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

// NDJSON line types emitted by the streaming variant of
// `comment.loadComments`. The first line is always `meta` (carries the
// header that the legacy envelope shipped under `next` + counts), then
// one `item` line per fully-compiled root subtree, and finally a single
// `end` line. `error` is only emitted when the generator throws partway
// through; the `useApiStream` hook upgrades it to its `onError` callback.
export type LoadCommentsStreamLine =
  | {
      type: 'meta'
      count: number
      roots_count: number
      next: boolean
    }
  | { type: 'item'; comment: CommentItem }
  | { type: 'end' }
  | { type: 'error'; message: string }

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

// Output of `/api/actions/sidebar/snapshot`. Mirrors the SSR
// `loadSidebarData` result so the public `clientLoader` can drop the JSON
// payload directly into the route's loader data without re-projecting.
export interface SidebarSnapshotOutput {
  admin: boolean
  recentComments: LatestComment[]
  pendingComments: LatestComment[]
}
