import type { CommentWithUser } from '@/server/db/query/comment'

// Used for sidebar
export interface LatestComment {
  title: string
  author: string
  authorLink: string
  permalink: string
}

// Grouping the comments into parent child structure.
export interface CommentItem extends CommentAndUser {
  badgeTextColor?: string | null
  children?: CommentItem[]
}

// The Comment + User join shape used everywhere in the comment service. We
// re-export the inferred Drizzle projection so this DTO never drifts from
// the SQL `commentWithUser` source of truth — see `db/query/comment.server`.
export type CommentAndUser = CommentWithUser

// The comment list.
export interface Comments {
  comments: CommentAndUser[]
  count: number
  roots_count: number
}

export interface AdminComment extends CommentAndUser {
  badgeTextColor?: string | null
  pageTitle: string | null
}

export interface AdminCommentsResult {
  comments: AdminComment[]
  total: number
  hasMore: boolean
}

// Create comment request.
export interface CommentReq {
  page_key: string
  name: string
  email: string
  link?: string
  content: string
  rid?: number
}

// Error response in creating comment.
export interface ErrorResp {
  msg: string
}
