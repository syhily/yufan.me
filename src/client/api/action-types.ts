import type { ListUsersInput, MuteUserInput, UserIdInput } from '@/server/admin-users/schema'
import type { UpdateUserInput } from '@/server/auth-schema'
import type { AdminCacheStatsDto, ClearCacheResultDto } from '@/server/cache/admin-service'
import type { ClearCacheInput } from '@/server/cache/schema'
import type {
  CommentEditInput,
  CommentReplyInput,
  CommentRidInput,
  FilterAutocompleteInput,
  LoadAllCommentsInput,
} from '@/server/comments/schema'
import type { AdminComment, CommentItem } from '@/server/comments/types'
import type { BlogConstants, BlogSettings } from '@/server/settings/defaults'
import type { ResetSettingsInput, SendTestMailInput, UpdateSettingsInput } from '@/server/settings/schema'

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
// the same `<CommentItem />` and `<AdminCommentRow />` components used at
// SSR time. The bigint ids inside these payloads round-trip through React
// Router's turbo-stream serializer, which supports BigInt natively.
export interface ReplyCommentOutput {
  comment: CommentItem
  /** Next CSRF token for a follow-up `replyComment` without full page reload. */
  csrfToken: string
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

export type { FilterAutocompleteInput }

export interface SearchPagesOutput {
  pages: { key: string; title: string | null }[]
}

export interface SearchAuthorsOutput {
  authors: { id: string; name: string }[]
}

export type LoadAllInput = LoadAllCommentsInput

export interface LoadAllOutput {
  comments: AdminComment[]
  total: number
  hasMore: boolean
}

// --- Admin user-management endpoints --------------------------------------

export type { ListUsersInput, MuteUserInput, UserIdInput }

// `bigint` ids are serialised as strings on the wire (see
// `server/route-helpers/api-handler.ts` jsonReplacer); the wp-admin client
// keeps them as strings throughout to avoid `BigInt` plumbing in the UI.
export interface AdminUserDto {
  id: string
  name: string
  email: string
  link: string | null
  badgeName: string | null
  badgeColor: string | null
  badgeTextColor: string | null
  isAdmin: boolean
  isMuted: boolean
  emailVerified: boolean
  createdAt: string
  deletedAt: string | null
  lastIp: string | null
  lastUa: string | null
  commentCount: number
  pendingCount: number
  lastCommentAt: string | null
}

export interface ListUsersOutput {
  users: AdminUserDto[]
  total: number
  hasMore: boolean
}

export interface GetUserOutput {
  user: AdminUserDto
}

export interface MuteUserOutput {
  user: AdminUserDto
}

export interface BulkApproveOutput {
  approved: number
}

export interface BulkSoftDeleteOutput {
  deleted: number
}

export interface AdminMutationSuccessOutput {
  success: true
}

// --- Admin settings endpoints ---------------------------------------------

export type { BlogConstants, BlogSettings, ResetSettingsInput, UpdateSettingsInput }

export interface GetSettingsOutput {
  settings: BlogSettings
  constants: BlogConstants
}

export interface UpdateSettingsOutput {
  settings: BlogSettings
}

export interface ResetSettingsOutput {
  settings: BlogSettings
}

// --- Admin cache endpoints ------------------------------------------------

export type { ClearCacheInput }

export type GetCacheStatsOutput = AdminCacheStatsDto
export type ClearCacheOutput = ClearCacheResultDto

// --- Admin mail endpoint --------------------------------------------------

export type { SendTestMailInput }

export interface SendTestMailOutput {
  success: true
}
