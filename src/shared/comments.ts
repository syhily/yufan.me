export interface LatestComment {
  title: string
  author: string
  authorLink: string
  permalink: string
}

import type { CommentBody } from '@/shared/pt/comment-schema'

export interface CommentAndUser {
  id: bigint
  createAt: Date
  updatedAt: Date
  deleteAt: Date | null
  /**
   * Canonical PortableText body. Rendered by `<PortableTextBody>` on
   * the public site. The DB also retains a markdown projection of this
   * field under `comment.content`, but that's server-only and is NOT
   * projected into client DTOs (loaders strip it out).
   */
  body: CommentBody
  /**
   * Plain-text / markdown rollback snapshot. Present on server-side
   * `CommentAndUser` values (since the DB query selects it), null on
   * client-projected `CommentItem` values (the SSR loader nulls it out
   * before serialising to the wire).
   */
  content: string | null
  pageKey: string
  userId: bigint
  isVerified: boolean | null
  ua: string | null
  ip: string | null
  rid: number
  isCollapsed: boolean | null
  isPending: boolean | null
  isPinned: boolean | null
  voteUp: number | null
  voteDown: number | null
  rootId: bigint | null
  name: string
  email: string
  emailVerified: boolean
  link: string | null
  badgeName: string | null
  badgeColor: string | null
  badgeTextColor: string | null
}

export interface CommentItem extends CommentAndUser {
  children?: CommentItem[]
}

export interface Comments {
  comments: CommentAndUser[]
  count: number
  roots_count: number
}

export interface AdminComment extends CommentAndUser {
  pageTitle: string | null
}

export interface AdminCommentsResult {
  comments: AdminComment[]
  total: number
  hasMore: boolean
  /**
   * Per-status row counts under the current page/author filter context.
   * Always populated so the moderation segmented control (`全部 / 待审核
   * / 已审核`) can render its three badges in one round-trip.
   */
  statusCounts: { all: number; pending: number; approved: number }
}

export interface DetailPageComments {
  commentData: Comments | null
  commentItems: CommentItem[]
}

export interface CommentReq {
  page_key: string
  name: string
  email: string
  link?: string
  body: CommentBody
  rid?: number
}

export interface ErrorResp {
  msg: string
}
