import type { AstroSession } from 'astro'

import _ from 'lodash'

import type { NewComment } from '@/data/db'
import type { CommentAndUser, CommentItem, CommentReq, Comments, LatestComment } from '@/helpers/comment/types'

import config from '@/blog.config'
import * as commentRepo from '@/data/repositories/comment'
import * as pageRepo from '@/data/repositories/page'
import * as userRepo from '@/data/repositories/user'
import { DomainError } from '@/domain/errors'
import { isAdmin, userSession } from '@/helpers/auth/session'
import { createUser } from '@/helpers/auth/user'
import { parseContent } from '@/helpers/content/markdown'
import { sendApprovedComment, sendNewComment, sendNewReply } from '@/helpers/email/sender'
import { ErrorMessages } from '@/helpers/errors'

function trimSiteSuffix(title: string | null): string {
  let trim = title ?? ''
  if (trim.includes(` - ${config.title}`)) {
    trim = trim.substring(0, trim.indexOf(` - ${config.title}`))
  }
  return trim
}

function toLatestComment(row: commentRepo.PendingCommentRow): LatestComment {
  return {
    title: trimSiteSuffix(row.title),
    author: row.author ?? '',
    authorLink: row.authorLink ?? '',
    permalink: `${row.page}#user-comment-${row.id}`,
  }
}

export async function pendingComments(): Promise<LatestComment[]> {
  const rows = await commentRepo.pendingComments(config.settings.sidebar.comment)
  return rows.map(toLatestComment)
}

export async function latestComments(): Promise<LatestComment[]> {
  const adminIds = await commentRepo.adminUserIds()
  const ids = await commentRepo.latestDistinctCommentIds(adminIds, config.settings.sidebar.comment)
  const rows = await commentRepo.commentsByIds(ids, config.settings.sidebar.comment)
  return rows.map(toLatestComment)
}

export async function loadComments(
  session: AstroSession | undefined,
  key: string,
  title: string | null,
  offset: number,
): Promise<Comments | null> {
  await pageRepo.upsertPage(key, title)
  const pendingArray = session ? ((await isAdmin(session)) ? [false, true] : [false]) : [false]

  const counts = await commentRepo.countComments(key, pendingArray)
  const rootCounts = await commentRepo.countRootComments(key, pendingArray)
  const rootComments = await commentRepo.findRootComments(key, pendingArray, offset, config.settings.comments.size)
  const childComments = await commentRepo.findChildComments(
    key,
    pendingArray,
    rootComments.map((c) => c.id),
  )

  return {
    count: counts,
    roots_count: rootCounts,
    comments: [...rootComments, ...childComments],
  }
}

export async function increaseViews(key: string, title: string | null) {
  await pageRepo.upsertPage(key, title)
  if (import.meta.env.PROD) {
    // Aggregate writes in-memory and flush in batches; see MetricsBatcher.
    const { bumpPageView } = await import('@/services/metrics-batcher')
    bumpPageView(key)
  }
}

export async function approveComment(rid: string) {
  const id = BigInt(rid)
  await commentRepo.approveCommentById(id)
  const c = await commentRepo.findCommentWithUserAndPage(id)
  if (c) {
    sendApprovedComment(c.comment, c.user, c.page)
  }
}

export async function deleteComment(rid: string) {
  await commentRepo.deleteCommentById(BigInt(rid))
}

export async function createComment(
  commentReq: CommentReq,
  req: Request,
  clientAddress: string,
  session: AstroSession,
): Promise<CommentAndUser> {
  // Check page key
  const p = await pageRepo.findPageByKey(commentReq.page_key)
  if (p === null) {
    throw new DomainError('NOT_FOUND', ErrorMessages.COMMENT_PAGE_NOT_FOUND)
  }

  // Upsert the comment user.
  const u = await createUser(commentReq.name, commentReq.email, commentReq.link || '')
  if (u === null) {
    throw new DomainError('INTERNAL', ErrorMessages.COMMENT_USER_CREATE_FAILED)
  }

  // Block the comment from the Admin
  const loginUser = await userSession(session)
  if (u.isAdmin) {
    if (loginUser === undefined) {
      throw new DomainError('UNAUTHORIZED', ErrorMessages.COMMENT_ADMIN_REQUIRED)
    }
  }

  // Ensure the commenter is the same as the login user
  else if (loginUser !== undefined && loginUser.email !== u.email) {
    throw new DomainError('FORBIDDEN', ErrorMessages.COMMENT_EMAIL_MISMATCH)
  }

  // Ensure the registered user should login to comment
  if (u.password !== undefined && u.password !== null && u.password !== '' && loginUser === undefined) {
    throw new DomainError('UNAUTHORIZED', ErrorMessages.COMMENT_LOGIN_REQUIRED)
  }

  // Query the existing comments for the user for deduplication.
  const historicalComments = await commentRepo.recentCommentsForUserDedupe(10)
  if (historicalComments.find((c) => c.comment.content === commentReq.content)) {
    throw new DomainError('CONFLICT', ErrorMessages.COMMENT_DUPLICATE)
  }

  // Update the comment user information
  await userRepo.updateLastLogin(u.id, clientAddress, req.headers.get('User-Agent'))

  // Calculate comment architecture
  let rootId = 0n
  if (commentReq.rid !== undefined && commentReq.rid !== 0) {
    const ridBig = BigInt(commentReq.rid)
    const parentRoot = await commentRepo.findCommentRootId(ridBig)
    rootId = parentRoot !== null && parentRoot !== 0n ? parentRoot : ridBig
  }

  // Should I bypass the check.
  const approvedCount = await commentRepo.countApprovedCommentsByUser(u.id)
  const isPending = approvedCount === 0

  // Insert the comment
  const newComment: NewComment = {
    content: commentReq.content,
    pageKey: commentReq.page_key,
    userId: u.id,
    isVerified: u.emailVerified,
    ua: req.headers.get('User-Agent'),
    ip: clientAddress,
    rid: commentReq.rid || 0,
    isCollapsed: false,
    isPending,
    isPinned: false,
    voteUp: 0,
    voteDown: 0,
    rootId,
  }
  const cr = await commentRepo.insertComment(newComment)
  if (cr === null) {
    throw new DomainError('INTERNAL', ErrorMessages.COMMENT_CREATE_FAILED)
  }

  cr.content = await parseContent(cr.content || '该留言内容为空')

  const info: CommentAndUser = {
    id: cr.id,
    createAt: cr.createdAt,
    updatedAt: cr.updatedAt,
    deleteAt: cr.deletedAt,
    content: cr.content,
    pageKey: cr.pageKey,
    userId: cr.userId,
    isVerified: cr.isVerified,
    ua: cr.ua,
    ip: cr.ip,
    rid: cr.rid,
    isCollapsed: cr.isCollapsed,
    isPending: cr.isPending,
    isPinned: cr.isPinned,
    voteUp: cr.voteUp,
    voteDown: cr.voteDown,
    rootId: cr.rootId,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    link: u.link,
    badgeName: u.badgeName,
    badgeColor: u.badgeColor,
  }

  // Send the email.
  if (info.email !== config.author.email) {
    sendNewComment(info, p)
  }
  if (info.rid !== 0) {
    const source = await commentRepo.findCommentWithSourceUser(BigInt(info.rid))
    if (source) {
      sendNewReply(source.user, source.comment, info, p)
    }
  }

  return info
}

export async function getCommentById(rid: string) {
  return commentRepo.findCommentWithUserById(BigInt(rid))
}

export async function updateComment(rid: string, newContent: string) {
  const id = BigInt(rid)
  await commentRepo.updateCommentContent(id, newContent)

  const r = await commentRepo.findCommentWithUserById(id)
  if (r === null) return null

  r.content = await parseContent(r.content || '该留言内容为空')
  return r
}

// Load all comments with pagination for admin
export interface AdminComment extends CommentAndUser {
  pageTitle: string | null
}

export interface AdminCommentsResult {
  comments: AdminComment[]
  total: number
  hasMore: boolean
}

// 获取所有文章列表（用于筛选）
export async function getPageOptions(): Promise<Array<{ key: string; title: string }>> {
  return commentRepo.listAllPages()
}

// 获取所有评论人员列表（用于筛选）
export async function getCommentAuthors(): Promise<Array<{ id: bigint; name: string }>> {
  return commentRepo.listCommentAuthors()
}

// 修改 loadAllComments 函数签名以支持筛选
export async function loadAllComments(
  offset: number,
  limit: number,
  filterPageKey?: string,
  filterUserId?: bigint,
): Promise<AdminCommentsResult> {
  const filters: commentRepo.AdminListFilters = {
    pageKey: filterPageKey,
    userId: filterUserId,
  }
  const total = await commentRepo.countAllComments(filters)
  const comments = await commentRepo.listAdminComments(offset, limit, filters)

  return {
    comments: await Promise.all(
      comments.map(async (c) => ({
        ...c,
        content: await parseContent(c.content || '该留言内容为空'),
        pageTitle: c.pageTitle,
      })),
    ),
    total,
    hasMore: offset + limit < total,
  }
}

export async function parseComments(comments: CommentAndUser[]): Promise<CommentItem[]> {
  const parsedComments = await Promise.all(
    comments.map(async (comment) => ({
      ...comment,
      content: await parseContent(comment.content || '该留言内容为空'),
    })),
  )
  const childComments = _.groupBy(
    parsedComments.filter((comment) => !rootCommentFilter(comment)),
    (c) => c.rid,
  )

  return parsedComments.filter(rootCommentFilter).map((comment) => commentItems(comment, childComments))
}

function rootCommentFilter(comment: CommentAndUser): boolean {
  return comment.rid === 0 || comment.rid === null || comment.rid === undefined
}

function commentItems(comment: CommentAndUser, childComments: _.Dictionary<CommentAndUser[]>): CommentItem {
  const children = childComments[`${comment.id}`]
  if (children === undefined) {
    return comment
  }

  return { ...comment, children: children.map((child) => commentItems(child, childComments)) }
}
