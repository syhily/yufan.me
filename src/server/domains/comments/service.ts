import type { BlogSession } from '@/server/domains/auth/session-storage'
import type { AdminListFilters, AdminPendingKind, PendingCommentRow } from '@/server/domains/comments/repo'
import type {
  AdminCommentsResult,
  CommentAndUser,
  CommentItem,
  CommentReq,
  Comments,
  LatestComment,
} from '@/server/domains/comments/types'
import type { EntityTarget } from '@/server/infra/db/target'
import type { MetricRow, NewComment } from '@/server/infra/db/types'
import type { CommentBody } from '@/shared/pt/comment-schema'
import type { AdminPendingDashboardDto, AdminPendingItemDto } from '@/shared/types/comments'

import { userSession } from '@/server/domains/auth/primitives'
import { hasAtLeast } from '@/server/domains/auth/rbac'
import { withCommentBadgeTextColor } from '@/server/domains/comments/badge'
import { canonicalizeCommentBody } from '@/server/domains/comments/canonicalize'
import { sendApprovedComment, sendNewComment, sendNewReply } from '@/server/domains/comments/email'
import {
  adminUserIds,
  approveCommentById,
  commentsByIds,
  countAdminPendingDashboard,
  countAllComments,
  countApprovedCommentsByUser,
  countCommentsAndRoots,
  deleteCommentById,
  findChildComments,
  findCommentRootId,
  findCommentWithSourceUser,
  findCommentWithUserAndTarget,
  findCommentWithUserById,
  findRootComments,
  insertComment,
  latestDistinctCommentIds,
  listAdminComments,
  listAdminPendingDashboard,
  pendingComments as pendingCommentsRepo,
  recentCommentsForUserDedupe,
  searchCommentAuthors,
  searchPages,
  updateCommentBodyAndContent,
  updateOwnCommentBody,
  updateOwnCommentBodyAndPending,
} from '@/server/domains/comments/repo'
import { ensureMetric, findMetricByPublicId } from '@/server/infra/db/operations/metric'
import { insertCommentUser, updateLastLogin } from '@/server/infra/db/operations/user'
import { DomainError } from '@/server/infra/http/errors'
import { getLogger } from '@/server/infra/logger'
import { getSidebarWidgetCount, requireBlogSettingsSection } from '@/shared/config/blog'
import { groupBy } from '@/shared/utils/tools'

const log = getLogger('comments.loader')
const adminLog = getLogger('comments.admin')

// --- Metric helpers (shared with comments controller) ------------------------

export interface MetricTarget {
  type: 'post' | 'page'
  ownerId: bigint
}

export async function resolveMetricTarget(key: string): Promise<MetricTarget> {
  const row = await findMetricByPublicId(key)
  if (row === null || row.type === null || row.ownerId === null) {
    throw new DomainError('NOT_FOUND', '评论目标不存在')
  }
  if (row.type !== 'post' && row.type !== 'page') {
    throw new DomainError('BAD_REQUEST', '无效的评论目标类型')
  }
  return { type: row.type, ownerId: row.ownerId }
}

export async function safeResolveMetricTarget(key: string): Promise<MetricTarget | null> {
  const row = await findMetricByPublicId(key)
  if (row === null || row.type === null || row.ownerId === null) {
    return null
  }
  if (row.type !== 'post' && row.type !== 'page') {
    return null
  }
  return { type: row.type, ownerId: row.ownerId }
}

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
  const path = slug === '' ? '/' : `${entityPermalink(row.type, slug)}/`
  return {
    title: trimSiteSuffix(row.title),
    author: row.author ?? '',
    authorLink: row.authorLink ?? '',
    permalink: `${path}#user-comment-${row.id}`,
  }
}

export async function pendingComments(): Promise<LatestComment[]> {
  const rows = await pendingCommentsRepo(getSidebarWidgetCount(requireBlogSettingsSection('sidebar'), 'recentComments'))
  return rows.map(toLatestComment)
}

export async function latestComments(): Promise<LatestComment[]> {
  const limit = getSidebarWidgetCount(requireBlogSettingsSection('sidebar'), 'recentComments')
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
  const metricRow = await findMetricByPublicId(commentReq.page_key)
  if (metricRow === null || metricRow.type === null || metricRow.ownerId === null) {
    throw new DomainError('NOT_FOUND', '系统错误，评论的目标页面不存在。')
  }
  const target: EntityTarget = { type: metricRow.type as 'post' | 'page', ownerId: metricRow.ownerId }

  const u = await insertCommentUser(commentReq.name, commentReq.email, commentReq.link || '')
  if (u === null) {
    throw new DomainError('INTERNAL', '系统错误，用户创建失败。')
  }

  const loginUser = userSession(session)
  if (u.role === 'admin') {
    if (loginUser === undefined) {
      throw new DomainError('UNAUTHORIZED', '管理员账号需要登陆才能评论。')
    }
  } else if (loginUser !== undefined && loginUser.email !== u.email) {
    throw new DomainError('FORBIDDEN', '评论邮箱与登陆账号不相符。')
  }

  if (u.password !== undefined && u.password !== null && u.password !== '' && loginUser === undefined) {
    throw new DomainError('UNAUTHORIZED', '该邮箱已经注册，请登录后再进行评论留言。')
  }

  if (u.isMuted) {
    throw new DomainError('FORBIDDEN', '您的评论功能已被管理员禁用，如有疑问请联系站长。')
  }

  const { body: canonicalBody, content: markdownSnapshot } = await canonicalizeCommentBody(commentReq.body)

  if (u.role !== 'admin') {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recent = await recentCommentsForUserDedupe(u.id, since, 20)
    if (recent.some((c) => c.content === markdownSnapshot)) {
      throw new DomainError('CONFLICT', '重复评论，你已经有了相同的留言，如果在页面看不到，说明它正在等待站长审核。')
    }
  }

  await updateLastLogin(u.id, clientAddress, req.headers.get('User-Agent'))

  let rootId = 0n
  if (commentReq.rid !== undefined && commentReq.rid !== 0) {
    const ridBig = BigInt(commentReq.rid)
    const parentRoot = await findCommentRootId(ridBig)
    rootId = parentRoot !== null && parentRoot !== 0n ? parentRoot : ridBig
  }

  const approvedCount = await countApprovedCommentsByUser(u.id)
  const isPending = approvedCount === 0

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
        nextRid = 0
        break
      }
      seen.add(nextRid)
      const parent = byId.get(String(nextRid))
      if (parent === undefined) {
        nextRid = 0
        break
      }
      if (parent.deleteAt === null) {
        break
      }
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

// --- Moderation --------------------------------------------------------------

export async function approveComment(rid: string) {
  const id = BigInt(rid)
  await approveCommentById(id)
  const c = await findCommentWithUserAndTarget(id)
  if (c && c.comment.type !== null && c.comment.ownerId !== null) {
    const target: EntityTarget = { type: c.comment.type as 'post' | 'page', ownerId: c.comment.ownerId }
    void sendApprovedComment(c.comment, c.user, target).catch((error) => {
      adminLog.error('failed to send approved comment email', { error })
    })
  }
}

export async function deleteComment(rid: string) {
  await deleteCommentById(BigInt(rid))
}

export async function getCommentById(rid: string) {
  return findCommentWithUserById(BigInt(rid))
}

export async function updateComment(rid: string, newBody: CommentBody) {
  const id = BigInt(rid)
  const { body, content } = await canonicalizeCommentBody(newBody)
  await updateCommentBodyAndContent(id, body, content)

  const r = await findCommentWithUserById(id)
  if (r === null) {
    return null
  }

  return { ...withCommentBadgeTextColor(r), content: null }
}

const OWN_EDIT_GRACE_MS = 30 * 60 * 1000

export async function updateOwnComment(rid: string, newBody: CommentBody) {
  const id = BigInt(rid)
  const existing = await findCommentWithUserById(id)
  if (existing === null) {
    return null
  }
  const { body, content } = await canonicalizeCommentBody(newBody)
  const insideGrace = Date.now() - existing.createAt.getTime() < OWN_EDIT_GRACE_MS
  if (insideGrace) {
    await updateOwnCommentBody(id, body, content)
  } else {
    await updateOwnCommentBodyAndPending(id, body, content)
  }

  const r = await findCommentWithUserById(id)
  if (r === null) {
    return null
  }

  if (!insideGrace) {
    if (r.type !== null && r.ownerId !== null) {
      const target: EntityTarget = { type: r.type, ownerId: r.ownerId }
      void sendNewComment(r, target).catch((error) => {
        adminLog.error('failed to send new comment email (own edit)', { error })
      })
    } else {
      adminLog.warn('skipping new-comment email after own edit: missing target', { commentId: id })
    }
  }

  return { ...withCommentBadgeTextColor(r), content: null }
}

export async function searchPageOptions(
  q: string | undefined,
  limit: number,
  publicIds?: string[],
): Promise<Array<{ key: string; title: string }>> {
  return searchPages(q, limit, publicIds)
}

export async function searchAuthorOptions(
  q: string | undefined,
  limit: number,
  ids?: bigint[],
): Promise<Array<{ id: bigint; name: string }>> {
  return searchCommentAuthors(q, limit, ids)
}

const DASHBOARD_EXCERPT_LIMIT = 120

function makeDashboardExcerpt(raw: string | null): string {
  if (!raw) {
    return ''
  }
  const trimmed = raw.trim()
  if (trimmed === '') {
    return ''
  }
  const codepoints = Array.from(trimmed)
  if (codepoints.length <= DASHBOARD_EXCERPT_LIMIT) {
    return trimmed
  }
  return `${codepoints.slice(0, DASHBOARD_EXCERPT_LIMIT).join('')}…`
}

export async function loadAdminPendingDashboard(
  kind: AdminPendingKind,
  offset: number,
  limit: number,
): Promise<AdminPendingDashboardDto> {
  const [rows, counts] = await Promise.all([
    listAdminPendingDashboard(kind, offset, limit),
    countAdminPendingDashboard(),
  ])
  const items: AdminPendingItemDto[] = rows.map((row) => ({
    id: String(row.id),
    kind: row.deleteRequestedAt !== null ? 'deletion' : 'approval',
    authorName: row.authorName,
    authorLink: row.authorLink,
    excerpt: makeDashboardExcerpt(row.content),
    createdAtIso: row.createdAt.toISOString(),
    deleteRequestedAtIso: row.deleteRequestedAt ? row.deleteRequestedAt.toISOString() : null,
    pageTitle: row.pageTitle,
    pagePermalink: row.pageSlug && row.type ? entityPermalink(row.type, row.pageSlug) : null,
  }))
  const total = kind === 'approval' ? counts.approval : kind === 'deletion' ? counts.deletion : counts.all
  return {
    items,
    total,
    hasMore: offset + items.length < total,
    counts,
  }
}

export async function loadAllComments(
  offset: number,
  limit: number,
  filterPublicId?: string,
  filterUserId?: bigint,
  status?: 'all' | 'pending' | 'approved',
): Promise<AdminCommentsResult> {
  let target: EntityTarget | undefined
  if (filterPublicId) {
    const metricRow = await findMetricByPublicId(filterPublicId)
    if (metricRow !== null && metricRow.type !== null && metricRow.ownerId !== null) {
      target = { type: metricRow.type as 'post' | 'page', ownerId: metricRow.ownerId }
    } else {
      return {
        comments: [],
        total: 0,
        hasMore: false,
        statusCounts: { all: 0, pending: 0, approved: 0 },
      }
    }
  }
  const baseFilters = { target, userId: filterUserId } satisfies AdminListFilters
  const filters: AdminListFilters = { ...baseFilters, status }
  const [comments, allCount, pendingCount, approvedCount] = await Promise.all([
    listAdminComments(offset, limit, filters),
    countAllComments({ ...baseFilters, status: 'all' }),
    countAllComments({ ...baseFilters, status: 'pending' }),
    countAllComments({ ...baseFilters, status: 'approved' }),
  ])
  const total = status === 'pending' ? pendingCount : status === 'approved' ? approvedCount : allCount

  return {
    comments: comments.map((c) => ({
      ...withCommentBadgeTextColor(c),
      content: null,
      pageTitle: c.pageTitle,
      pagePublicId: c.pagePublicId,
    })),
    total,
    hasMore: offset + limit < total,
    statusCounts: { all: allCount, pending: pendingCount, approved: approvedCount },
  }
}
