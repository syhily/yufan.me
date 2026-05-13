import type { CommentAndUser, CommentItem, CommentReq, Comments, LatestComment } from '@/server/comments/types'
import type { PendingCommentRow } from '@/server/db/query/comment'
import type { EntityTarget } from '@/server/db/target'
import type { MetricRow, NewComment } from '@/server/db/types'

import { withCommentBadgeTextColor } from '@/server/comments/badge'
import { canonicalizeCommentBody } from '@/server/comments/canonicalize'
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
import { ensureMetric, findMetricByPublicId } from '@/server/db/query/metric'
import { insertCommentUser, updateLastLogin } from '@/server/db/query/user'
import { sendNewComment, sendNewReply } from '@/server/email/sender'
import { getLogger } from '@/server/logger'
import { DomainError } from '@/server/route-helpers/errors'
import { isAdmin, userSession, type BlogSession } from '@/server/session'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { groupBy } from '@/shared/tools'
const log = getLogger('comments.loader')

function trimSiteSuffix(title: string | null): string {
  let trim = title ?? ''
  const siteTitle = requireBlogSettingsSection('siteIdentity').title
  if (trim.includes(` - ${siteTitle}`)) {
    trim = trim.substring(0, trim.indexOf(` - ${siteTitle}`))
  }
  return trim
}

function entityPermalink(type: 'post' | 'page', slug: string): string {
  return type === 'post' ? `/posts/${slug}` : `/${slug}`
}

function toLatestComment(row: PendingCommentRow): LatestComment {
  const slug = row.slug ?? ''
  // Without a slug the entity has been deleted or never existed — link
  // back to the homepage to keep the moderation widget useful. Sidebar
  // widgets render via <Link to=...>, so the permalink must be a
  // same-origin path; the trailing slash before the hash matches the
  // canonical post / page URL shape so React Router does not 301 the
  // route on navigation.
  const path = slug === '' ? '/' : `${entityPermalink(row.type, slug)}/`
  return {
    title: trimSiteSuffix(row.title),
    author: row.author ?? '',
    authorLink: row.authorLink ?? '',
    permalink: `${path}#user-comment-${row.id}`,
  }
}

export async function pendingComments(): Promise<LatestComment[]> {
  const rows = await pendingCommentsRepo(requireBlogSettingsSection('sidebar').sidebar.comment)
  return rows.map(toLatestComment)
}

export async function latestComments(): Promise<LatestComment[]> {
  const limit = requireBlogSettingsSection('sidebar').sidebar.comment
  const ids = await adminUserIds()
  const distinctIds = await latestDistinctCommentIds(ids, limit)
  const rows = await commentsByIds(distinctIds, limit)
  return rows.map(toLatestComment)
}

export async function loadComments(
  session: BlogSession,
  target: EntityTarget,
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
    ensurePage ? ensureMetric(target) : Promise.resolve(null),
    countCommentsAndRoots(target, pendingArray),
    findRootComments(target, pendingArray, offset, requireBlogSettingsSection('comments').comments.size),
  ])
  const childComments = await findChildComments(
    target,
    pendingArray,
    rootComments.map((c) => c.id),
  )

  return {
    count: counts.total,
    roots_count: counts.roots,
    comments: [...rootComments, ...childComments],
  }
}

export async function ensureCommentPage(target: EntityTarget): Promise<MetricRow> {
  return ensureMetric(target)
}

export async function createComment(
  commentReq: CommentReq,
  req: Request,
  clientAddress: string,
  session: BlogSession,
): Promise<CommentAndUser> {
  // Resolve the wire `page_key` (now a UUID surrogate) back to an
  // entity target. The metric row carries the canonical (type, owner_id).
  const metricRow = await findMetricByPublicId(commentReq.page_key)
  if (metricRow === null || metricRow.type === null || metricRow.ownerId === null) {
    throw new DomainError('NOT_FOUND', '系统错误，评论的目标页面不存在。')
  }
  const target: EntityTarget = { type: metricRow.type as 'post' | 'page', ownerId: metricRow.ownerId }

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

  // Block muted users from posting. Admins flip this flag from the
  // admin user-management page; the muted user keeps the ability to
  // browse the site but loses comment posting privileges. Admins
  // themselves cannot be muted (the admin UI hides the action), so
  // there is no need to special-case them here.
  if (u.isMuted) {
    throw new DomainError('FORBIDDEN', '您的评论功能已被管理员禁用，如有疑问请联系站长。')
  }

  // Canonicalise the incoming PT body: validate the comment-scoped
  // schema, prerender heavy assets (Shiki + KaTeX), and derive the
  // markdown rollback snapshot that gets stored alongside the JSONB
  // representation in `comment.content`.
  const { body: canonicalBody, content: markdownSnapshot } = await canonicalizeCommentBody(commentReq.body)

  // Query the existing comments for the user for deduplication. Scoped to
  // (userId, last 7 days). Admins are exempt because they may legitimately
  // post the same canned reply on different threads. Dedupe compares the
  // markdown snapshot — comparing JSON would defeat the check because
  // each save mints fresh `_key` nanoids on every block.
  if (!u.isAdmin) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recent = await recentCommentsForUserDedupe(u.id, since, 20)
    if (recent.some((c) => c.content === markdownSnapshot)) {
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
    content: markdownSnapshot,
    body: canonicalBody,
    type: target.type,
    ownerId: target.ownerId,
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
    badgeTextColor: u.badgeTextColor,
  })

  // Send the email.
  if (info.email !== requireBlogSettingsSection('siteIdentity').author.email) {
    void sendNewComment(info, target).catch((error) => {
      log.error('failed to send new comment email', { error })
    })
  }
  if (info.rid !== 0) {
    const source = await findCommentWithSourceUser(BigInt(info.rid))
    if (source) {
      void sendNewReply(source.user, source.comment, info, target).catch((error) => {
        log.error('failed to send new reply email', { error })
      })
    }
  }

  return info
}

export async function parseComments(comments: CommentAndUser[]): Promise<CommentItem[]> {
  // PT bodies are stored pre-rendered (Shiki/KaTeX MathML baked into
  // `body` at save time), so the public projection just strips the
  // server-only `content` markdown snapshot and adds the badge text
  // colour. The function stays `async` so the existing `await` call
  // sites don't need to change.
  const projected = comments.map((comment) => ({
    ...withCommentBadgeTextColor(comment),
    content: null,
  }))
  const childComments = groupBy(
    projected.filter((comment) => !rootCommentFilter(comment)),
    (c) => String(c.rid),
  )

  return projected.filter(rootCommentFilter).map((comment) => commentItems(comment, childComments))
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
