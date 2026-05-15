import type { ClearCacheInput, ClearCacheResultDto, AdminCacheStatsDto } from '@/shared/cache-types'
import type { AdminComment, AdminPendingDashboardDto, AdminPendingKind, CommentItem } from '@/shared/comments'
import type { CommentBody } from '@/shared/pt/comment-schema'
import type { UpdateSettingsInput } from '@/shared/settings'
import type { AdminUserDto, ListUsersInput, MuteUserInput, UserIdInput } from '@/shared/users'

export interface UpdateUserInput {
  userId: string
  name?: string
  email?: string
  link?: string
  badgeName?: string
  badgeColor?: string
  badgeTextColor?: string | null
}

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

export interface CommentReplyInput {
  page_key: string
  name: string
  email: string
  link?: string
  body: CommentBody
  csrf: string
  rid?: number
  subtitle?: string
}

export type ReplyCommentInput = CommentReplyInput

export interface CommentRidInput {
  rid: string
}

export interface CommentEditInput extends CommentRidInput {
  body: CommentBody
}

export interface LoadCommentsInput {
  page_key: string
  offset: number
}

export interface LoadAllCommentsInput {
  offset: number
  limit: number
  pageKey?: string
  userId?: string
  status?: 'all' | 'pending' | 'approved'
}

export interface FilterAutocompleteInput {
  q?: string
  limit?: number
  ids?: string | string[]
  key?: string
}

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
  body: CommentBody
}

export interface MyCommentsOutput {
  comments: CommentItem[]
  /**
   * Map from comment id string to token expiration timestamp (ms).
   * The UI uses this to show "editable for X more minutes" hints.
   */
  expiresAt: Record<string, number>
}

export interface RevokeCommentTokenOutput {
  success: true
}

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
  /**
   * Counts for each status filter under the SAME page/user filter
   * context (so picking an author and then switching tabs always shows
   * that author's counts). The currently-selected tab's count equals
   * `total`, but we ship all three so the unselected tabs can still
   * render their badges without an extra round-trip.
   */
  statusCounts: { all: number; pending: number; approved: number }
}

export type { AdminUserDto, ListUsersInput, MuteUserInput, UserIdInput }

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

export type { UpdateSettingsInput }

export interface UpdateSettingsOutput {
  success: true
}

export type { ClearCacheInput }

export type GetCacheStatsOutput = AdminCacheStatsDto
export type ClearCacheOutput = ClearCacheResultDto

export interface ListPendingDashboardInput {
  kind?: AdminPendingKind
  offset?: number
  limit?: number
}
export type ListPendingDashboardOutput = AdminPendingDashboardDto

export interface SendTestMailInput {
  to: string
}

export interface SendTestMailOutput {
  success: true
}
