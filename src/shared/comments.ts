export interface LatestComment {
  title: string
  author: string
  authorLink: string
  permalink: string
}

export interface CommentAndUser {
  id: bigint
  createAt: Date
  updatedAt: Date
  deleteAt: Date | null
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
  content: string
  rid?: number
}

export interface ErrorResp {
  msg: string
}
