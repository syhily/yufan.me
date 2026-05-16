import type { BlogSession } from '@/server/domains/auth/session-storage'
import type { CommentAndUser, CommentItem, CommentReq, Comments, LatestComment } from '@/server/domains/comments/types'
import type { PendingCommentRow } from '@/server/infra/db/operations/comment'
import type { EntityTarget } from '@/server/infra/db/target'
import type { MetricRow, NewComment } from '@/server/infra/db/types'

import { userSession } from '@/server/domains/auth/primitives'
import { hasAtLeast } from '@/server/domains/auth/rbac'
import { withCommentBadgeTextColor } from '@/server/domains/comments/badge'
import { canonicalizeCommentBody } from '@/server/domains/comments/canonicalize'
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
} from '@/server/infra/db/operations/comment'
import { ensureMetric, findMetricByPublicId } from '@/server/infra/db/operations/metric'
import { insertCommentUser, updateLastLogin } from '@/server/infra/db/operations/user'
import { sendNewComment, sendNewReply } from '@/server/infra/email/sender'
import { DomainError } from '@/server/infra/http/errors'
import { getLogger } from '@/server/infra/logger'
import { requireBlogSettingsSection } from '@/shared/config/blog'
import { groupBy } from '@/shared/utils/tools'
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
  // author/visitor see approved + their own pending / delete-requested.
  const user = userSession(session)
  const role = user?.role ?? null
  const pendingArray: boolean[] = hasAtLeast(role, 'admin') ? [false, true] : [false]
  const currentUserId = user?.id ? BigInt(user.id) : undefined

  const [, counts, rootComments] = await Promise.all([
    ensurePage ? ensureMetric(target) : Promise.resolve(null),
    countCommentsAndRoots(target, pendingArray, currentUserId),
    findRootComments(target, pendingArray, offset, requireBlogSettingsSection('comments').comments.size, currentUserId),
  ])
  const childComments = await findChildComments(
    target,
    pendingArray,
    rootComments.map((c) => c.id),
    currentUserId,
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
  if (u.role === 'admin') {
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
  if (u.role !== 'admin') {
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
  //
  // Soft-deleted reparenting: rows with `deleteAt !== null` are kept in
  // the input set strictly so their *id* can act as a routing waypoint,
  // but they are never rendered. For each surviving reply, we walk the
  // `rid` chain skipping deleted ancestors so the reply re-attaches to
  // its nearest live ancestor (or becomes a root if every ancestor up
  // to `rid=0` is deleted / missing). The walk is bounded to avoid
  // cycles or pathological depth.
  const MAX_RID_WALK = 256
  const byId = new Map<string, CommentAndUser>()
  for (const c of comments) {
    byId.set(String(c.id), c)
  }

  const rewritten: CommentAndUser[] = []
  for (const c of comments) {
    if (c.deleteAt !== null) {
      continue
    }
    let nextRid = c.rid
    // Self-cycle (rid === own id) is the most common pathological case.
    // Seed the visited set with the row's own id so the first hop into
    // itself trips the cycle guard regardless of whether the row counts
    // as "deleted" or not.
    const ownIdNumeric = Number(c.id)
    const seen = new Set<number>()
    if (Number.isFinite(ownIdNumeric)) {
      seen.add(ownIdNumeric)
    }
    for (let i = 0; i < MAX_RID_WALK; i++) {
      if (nextRid === 0 || nextRid === null || nextRid === undefined) {
        break
      }
      if (seen.has(nextRid)) {
        // Cycle guard: fall back to root rather than spin forever.
        nextRid = 0
        break
      }
      seen.add(nextRid)
      const parent = byId.get(String(nextRid))
      if (parent === undefined) {
        // Parent absent from this page (filtered out by paging or
        // visibility). Treat as a root so the reply still renders.
        nextRid = 0
        break
      }
      if (parent.deleteAt === null) {
        break
      }
      // Parent is soft-deleted: keep walking up.
      nextRid = parent.rid
    }
    rewritten.push({ ...c, rid: nextRid })
  }

  const projected = rewritten.map((comment) => ({
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
