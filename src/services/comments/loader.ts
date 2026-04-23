import type { AstroSession } from 'astro'

import type { AdminListFilters, PendingCommentRow } from '@/db/query/comment'
import type { NewComment } from '@/db/types'
import type { CommentAndUser, CommentItem, CommentReq, Comments, LatestComment } from '@/services/comments/types'

import config from '@/blog.config'
import {
  adminUserIds,
  approveCommentById,
  commentsByIds,
  countAllComments,
  countApprovedCommentsByUser,
  countComments,
  countRootComments,
  deleteCommentById,
  findChildComments,
  findCommentRootId,
  findCommentWithSourceUser,
  findCommentWithUserAndPage,
  findCommentWithUserById,
  findRootComments,
  insertComment,
  latestDistinctCommentIds,
  listAdminComments,
  listAllPages,
  listCommentAuthors,
  pendingComments as pendingCommentsRepo,
  recentCommentsForUserDedupe,
  updateCommentContent,
} from '@/db/query/comment'
import { findPageByKey, upsertPage } from '@/db/query/page'
import { insertCommentUser, updateLastLogin } from '@/db/query/user'
import { DomainError } from '@/domain/errors'
import { isAdmin, userSession } from '@/services/auth/session'
import { sendApprovedComment, sendNewComment, sendNewReply } from '@/services/email/sender'
import { parseContent } from '@/services/markdown/parser'
import { ErrorMessages } from '@/shared/messages'
import { groupBy } from '@/shared/tools'

function trimSiteSuffix(title: string | null): string {
  let trim = title ?? ''
  if (trim.includes(` - ${config.title}`)) {
    trim = trim.substring(0, trim.indexOf(` - ${config.title}`))
  }
  return trim
}

function toLatestComment(row: PendingCommentRow): LatestComment {
  return {
    title: trimSiteSuffix(row.title),
    author: row.author ?? '',
    authorLink: row.authorLink ?? '',
    permalink: `${row.page}#user-comment-${row.id}`,
  }
}

export async function pendingComments(): Promise<LatestComment[]> {
  const rows = await pendingCommentsRepo(config.settings.sidebar.comment)
  return rows.map(toLatestComment)
}

export async function latestComments(): Promise<LatestComment[]> {
  const ids = await adminUserIds()
  const distinctIds = await latestDistinctCommentIds(ids, config.settings.sidebar.comment)
  const rows = await commentsByIds(distinctIds, config.settings.sidebar.comment)
  return rows.map(toLatestComment)
}

export async function loadComments(
  session: AstroSession | undefined,
  key: string,
  title: string | null,
  offset: number,
): Promise<Comments | null> {
  // upsertPage and isAdmin are independent of one another; run them in parallel
  // with the page metadata write so the request waits for the slowest, not
  // the sum.
  const [, pendingArray] = await Promise.all([
    upsertPage(key, title),
    (async (): Promise<boolean[]> => (session ? ((await isAdmin(session)) ? [false, true] : [false]) : [false]))(),
  ])

  // Counts and root comments are also independent. Fetch them in parallel,
  // then derive the child comments which depend on the root id list.
  const [counts, rootCounts, rootComments] = await Promise.all([
    countComments(key, pendingArray),
    countRootComments(key, pendingArray),
    findRootComments(key, pendingArray, offset, config.settings.comments.size),
  ])
  const childComments = await findChildComments(
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
  await upsertPage(key, title)
  if (import.meta.env.PROD) {
    // Aggregate writes in-memory and flush in batches; see MetricsBatcher.
    const { bumpPageView } = await import('@/services/metrics/batcher')
    bumpPageView(key)
  }
}

export async function approveComment(rid: string) {
  const id = BigInt(rid)
  await approveCommentById(id)
  const c = await findCommentWithUserAndPage(id)
  if (c) {
    sendApprovedComment(c.comment, c.user, c.page)
  }
}

export async function deleteComment(rid: string) {
  await deleteCommentById(BigInt(rid))
}

export async function createComment(
  commentReq: CommentReq,
  req: Request,
  clientAddress: string,
  session: AstroSession,
): Promise<CommentAndUser> {
  // Check page key
  const p = await findPageByKey(commentReq.page_key)
  if (p === null) {
    throw new DomainError('NOT_FOUND', ErrorMessages.COMMENT_PAGE_NOT_FOUND)
  }

  // Upsert the comment user.
  const u = await insertCommentUser(commentReq.name, commentReq.email, commentReq.link || '')
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
  const historicalComments = await recentCommentsForUserDedupe(10)
  if (historicalComments.find((c) => c.comment.content === commentReq.content)) {
    throw new DomainError('CONFLICT', ErrorMessages.COMMENT_DUPLICATE)
  }

  // Update the comment user information
  await updateLastLogin(u.id, clientAddress, req.headers.get('User-Agent'))

  // Calculate comment architecture
  let rootId = 0n
  if (commentReq.rid !== undefined && commentReq.rid !== 0) {
    const ridBig = BigInt(commentReq.rid)
    const parentRoot = await findCommentRootId(ridBig)
    rootId = parentRoot !== null && parentRoot !== 0n ? parentRoot : ridBig
  }

  // Should I bypass the check.
  const approvedCount = await countApprovedCommentsByUser(u.id)
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
  const cr = await insertComment(newComment)
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
    const source = await findCommentWithSourceUser(BigInt(info.rid))
    if (source) {
      sendNewReply(source.user, source.comment, info, p)
    }
  }

  return info
}

export async function getCommentById(rid: string) {
  return findCommentWithUserById(BigInt(rid))
}

export async function updateComment(rid: string, newContent: string) {
  const id = BigInt(rid)
  await updateCommentContent(id, newContent)

  const r = await findCommentWithUserById(id)
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
  return listAllPages()
}

// 获取所有评论人员列表（用于筛选）
export async function getCommentAuthors(): Promise<Array<{ id: bigint; name: string }>> {
  return listCommentAuthors()
}

// 修改 loadAllComments 函数签名以支持筛选
export async function loadAllComments(
  offset: number,
  limit: number,
  filterPageKey?: string,
  filterUserId?: bigint,
  status?: 'all' | 'pending' | 'approved',
): Promise<AdminCommentsResult> {
  const filters: AdminListFilters = {
    pageKey: filterPageKey,
    userId: filterUserId,
    status,
  }
  // Count and list are independent queries — fetch them concurrently.
  const [total, comments] = await Promise.all([countAllComments(filters), listAdminComments(offset, limit, filters)])

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
  const childComments = groupBy(
    parsedComments.filter((comment) => !rootCommentFilter(comment)),
    (c) => String(c.rid),
  )

  return parsedComments.filter(rootCommentFilter).map((comment) => commentItems(comment, childComments))
}

function rootCommentFilter(comment: CommentAndUser): boolean {
  return comment.rid === 0 || comment.rid === null || comment.rid === undefined
}

function commentItems(comment: CommentAndUser, childComments: Record<string, CommentAndUser[]>): CommentItem {
  const children = childComments[`${comment.id}`]
  if (children === undefined) {
    return comment
  }

  return { ...comment, children: children.map((child) => commentItems(child, childComments)) }
}
