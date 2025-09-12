import type { Comment, User } from '@/helpers/db/types'

// Used for sidebar
export interface LatestComment {
  title: string
  author: string
  authorLink: string
  permalink: string
}

// Grouping the comments into parent child structure.
export interface CommentItem extends CommentAndUser {
  children?: CommentItem[]
}

// The inserted result for a comment.
export interface CommentAndUser {
  id: Comment['id']
  createAt: Comment['createdAt']
  updatedAt: Comment['updatedAt']
  deleteAt: Comment['deletedAt']
  content: Comment['content']
  pageKey: Comment['pageKey']
  userId: Comment['userId']
  isVerified: Comment['isVerified']
  ua: Comment['ua']
  ip: Comment['ip']
  rid: Comment['rid']
  isCollapsed: Comment['isCollapsed']
  isPending: Comment['isPending']
  isPinned: Comment['isPinned']
  voteUp: Comment['voteUp']
  voteDown: Comment['voteDown']
  rootId: Comment['rootId']
  name: User['name']
  email: User['email']
  emailVerified: User['emailVerified']
  link: User['link']
  badgeName: User['badgeName']
  badgeColor: User['badgeColor']
}

// The comment list.
export interface Comments {
  comments: CommentAndUser[]
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

// Error response in creating comment.
export interface ErrorResp {
  msg: string
}
