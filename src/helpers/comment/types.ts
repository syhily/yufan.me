import type { Comment } from '@/helpers/db/types'

// Used for sidebar
export interface LatestComment {
  title: string
  author: string
  authorLink: string
  permalink: string
}

// Grouping the comments into parent child structure.
export interface CommentItem extends Comment {
  children?: CommentItem[]
}

// The comment list.
export interface Comments {
  comments: Comment[]
  count: number
  roots_count: number
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

// Create comment response.
export interface CommentResp extends Comment {
  is_pending: boolean
}

// Error response in creating comment.
export interface ErrorResp {
  msg: string
}
