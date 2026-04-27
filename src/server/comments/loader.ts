import type { CommentAndUser, CommentItem, CommentReq, Comments, LatestComment } from '@/server/comments/types'
import type { PendingCommentRow } from '@/server/db/query/comment'
import type { NewComment } from '@/server/db/types'

import config from '@/blog.config'
import { withCommentBadgeTextColor } from '@/server/comments/badge'
import {
  adminUserIds,
  commentsByIds,
  countApprovedCommentsByUser,
  countCommentsAndRoots,
  findChildComments,
  findCommentRootId,
  findCommentWithSourceUser,
  findRootComments,
  insertComment,
  latestDistinctCommentIds,
  pendingComments as pendingCommentsRepo,
  recentCommentsForUserDedupe,
} from '@/server/db/query/comment'
import { findPageByKey, upsertPage } from '@/server/db/query/page'
import { insertCommentUser, updateLastLogin } from '@/server/db/query/user'
import { sendNewComment, sendNewReply } from '@/server/email/sender'
import { getLogger } from '@/server/logger'
import { compileMarkdown } from '@/server/markdown/runtime'
import { DomainError } from '@/server/route-helpers/errors'
import { isAdmin, userSession, type BlogSession } from '@/server/session'
import { groupBy } from '@/shared/tools'

const log = getLogger('comments.loader')

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
  session: BlogSession,
  key: string,
  title: string | null,
  offset: number,
  options: { ensurePage?: boolean } = {},
): Promise<Comments | null> {
  const ensurePage = options.ensurePage ?? true
  // Admins see both approved (pending=false) and pending (pending=true) rows;
  // everyone else only sees approved ones.
  const pendingArray: boolean[] = isAdmin(session) ? [false, true] : [false]

  // Total + root counts are derived in a single query (filtered aggregate);
  // both fan out in parallel with the page upsert and root listing. Child
  // comments depend on the root id list, so they're issued afterwards.
  const [, counts, rootComments] = await Promise.all([
    ensurePage ? upsertPage(key, title) : Promise.resolve(null),
    countCommentsAndRoots(key, pendingArray),
    findRootComments(key, pendingArray, offset, config.settings.comments.size),
  ])
  const childComments = await findChildComments(
    key,
    pendingArray,
    rootComments.map((c) => c.id),
  )

  return {
    count: counts.total,
    roots_count: counts.roots,
    comments: [...rootComments, ...childComments],
  }
}

export async function ensureCommentPage(key: string, title: string | null) {
  await upsertPage(key, title)
}

export async function createComment(
  commentReq: CommentReq,
  req: Request,
  clientAddress: string,
  session: BlogSession,
): Promise<CommentItem> {
  // Check page key
  const p = await findPageByKey(commentReq.page_key)
  if (p === null) {
    throw new DomainError('NOT_FOUND', '系统错误，评论的目标页面不存在。')
  }

  // Upsert the comment user.
  const u = await insertCommentUser(commentReq.name, commentReq.email, commentReq.link || '')
  if (u === null) {
    throw new DomainError('INTERNAL', '系统错误，用户创建失败。')
  }

  // Block the comment from the Admin
  const loginUser = userSession(session)
  if (u.isAdmin) {
    if (loginUser === undefined) {
      throw new DomainError('UNAUTHORIZED', '管理员账号需要登陆才能评论。')
    }
  }

  // Ensure the commenter is the same as the login user
  else if (loginUser !== undefined && loginUser.email !== u.email) {
    throw new DomainError('FORBIDDEN', '评论邮箱与登陆账号不相符。')
  }

  // Ensure the registered user should login to comment
  if (u.password !== undefined && u.password !== null && u.password !== '' && loginUser === undefined) {
    throw new DomainError('UNAUTHORIZED', '该邮箱已经注册，请登录后再进行评论留言。')
  }

  // Query the existing comments for the user for deduplication. Scoped to
  // (userId, last 7 days). Admins are exempt because they may legitimately
  // post the same canned reply on different threads.
  if (!u.isAdmin) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recent = await recentCommentsForUserDedupe(u.id, since, 20)
    if (recent.some((c) => c.content === commentReq.content)) {
      throw new DomainError('CONFLICT', '重复评论，你已经有了相同的留言，如果在页面看不到，说明它正在等待站长审核。')
    }
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
    throw new DomainError('INTERNAL', '系统错误，评论创建失败。')
  }

  // `cr.content` stays raw markdown so the email senders can still pipe
  // it through `parseContent` (SMTP needs an HTML string). The DTO that
  // ships to the public client carries the compiled MDX body separately.
  const compiled = await compileMarkdown(cr.content, { profile: 'comment' })

  const { createdAt, deletedAt, ...commentRest } = cr
  const info = withCommentBadgeTextColor({
    ...commentRest,
    createAt: createdAt,
    deleteAt: deletedAt,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    link: u.link,
    badgeName: u.badgeName,
    badgeColor: u.badgeColor,
    bodyCompiled: compiled?.compiled ?? null,
  })

  // Send the email.
  if (info.email !== config.author.email) {
    void sendNewComment(info, p).catch((error) => {
      log.error('failed to send new comment email', { error })
    })
  }
  if (info.rid !== 0) {
    const source = await findCommentWithSourceUser(BigInt(info.rid))
    if (source) {
      void sendNewReply(source.user, source.comment, info, p).catch((error) => {
        log.error('failed to send new reply email', { error })
      })
    }
  }

  return info
}

export async function parseComments(comments: CommentAndUser[]): Promise<CommentItem[]> {
  // `comment.content` stays as the raw markdown source — the UI consumes
  // the compiled MDX body via `bodyCompiled` (see `<CommentBody />`). The
  // public client never reads `content` for rendering; admin moderation
  // reaches for it through `comment.getRaw` when an editor is opened.
  const parsedComments = await Promise.all(
    comments.map(async (comment) => {
      const compiled = await compileMarkdown(comment.content, { profile: 'comment' })
      return {
        ...withCommentBadgeTextColor(comment),
        bodyCompiled: compiled?.compiled ?? null,
      }
    }),
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

function commentItems(comment: CommentItem, childComments: Record<string, CommentItem[]>): CommentItem {
  const children = childComments[`${comment.id}`]
  if (children === undefined) {
    return comment
  }

  return { ...comment, children: children.map((child) => commentItems(child, childComments)) }
}
