import type { AstroSession } from 'astro'
import type { CommentAndUser, CommentItem, CommentReq, Comments, ErrorResp, LatestComment } from '@/helpers/comment/types'
import type { NewComment, NewPage, Page } from '@/helpers/db/types'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import _ from 'lodash'
import config from '@/blog.config'
import { isAdmin, userSession } from '@/helpers/auth/session'
import { createUser } from '@/helpers/auth/user'
import { parseContent } from '@/helpers/content/markdown'
import * as pool from '@/helpers/db/pool'
import { comment, page, user } from '@/helpers/db/schema'
import { sendApprovedComment, sendNewComment, sendNewReply } from '@/helpers/email/sender'
import { ErrorMessages } from '@/helpers/errors'

async function upsertPage(key: string, title: string | null): Promise<Page> {
  const res = await pool.db.select().from(page).where(eq(page.key, key)).limit(1)
  if (res.length > 0) {
    const p = res[0]
    if (p.title !== title && title !== null) {
      // Update the page with the new title
      p.title = title
      await pool.db.update(page).set(p).where(eq(page.key, key)).returning()
    }
    return p
  }
  const np: NewPage = { title: title || '无标题', key, voteUp: 0, voteDown: 0, pv: 0 }
  return (await pool.db.insert(page).values(np).returning())[0]
}

export async function pendingComments(): Promise<LatestComment[]> {
  const results = await pool.db
    .select({
      id: comment.id,
      page: comment.pageKey,
      title: page.title,
      author: user.name,
      authorLink: user.link,
    })
    .from(comment)
    .innerJoin(page, eq(comment.pageKey, page.key))
    .innerJoin(user, eq(comment.userId, user.id))
    .where(eq(comment.isPending, true))
    .orderBy(desc(comment.id))
    .limit(config.settings.sidebar.comment)

  return results.map(({ title, author, authorLink, page, id }) => {
    let trimTitle = title ?? ''
    if (trimTitle.includes(` - ${config.title}`)) {
      trimTitle = trimTitle.substring(0, trimTitle.indexOf(` - ${config.title}`))
    }
    return {
      title: trimTitle,
      author: author ?? '',
      authorLink: authorLink ?? '',
      permalink: `${page}#user-comment-${id}`,
    }
  })
}

export async function latestComments(): Promise<LatestComment[]> {
  const admins = await pool.db.select({ id: user.id }).from(user).where(eq(user.isAdmin, true))
  const userFilterQuery = admins.length > 0 ? sql`user_id NOT IN (${admins.map(admin => admin.id).join(', ')})` : sql`1 = 1`
  const latestDistinctCommentsQuery = sql`SELECT    id
  FROM      (
            SELECT    id,
                      user_id,
                      created_at,
                      ROW_NUMBER() OVER (
                      PARTITION BY user_id
                      ORDER BY  created_at DESC
                      ) rn
            FROM      comment
            WHERE     ${userFilterQuery}
            AND       is_pending = FALSE
            ) AS most_recent
  WHERE     rn = 1
  ORDER BY  created_at DESC
  LIMIT     ${config.settings.sidebar.comment}`
  const latestDistinctComments = (await pool.db.execute(latestDistinctCommentsQuery)).rows.map(row => row.id).map(id => BigInt(`${id}`))
  const results = await pool.db
    .select({
      id: comment.id,
      page: comment.pageKey,
      title: page.title,
      author: user.name,
      authorLink: user.link,
    })
    .from(comment)
    .innerJoin(page, eq(comment.pageKey, page.key))
    .innerJoin(user, eq(comment.userId, user.id))
    .where(inArray(comment.id, latestDistinctComments))
    .orderBy(desc(comment.id))
    .limit(config.settings.sidebar.comment)

  return results.map(({ title, author, authorLink, page, id }) => {
    let trimTitle = title ?? ''
    if (trimTitle.includes(` - ${config.title}`)) {
      trimTitle = trimTitle.substring(0, trimTitle.indexOf(` - ${config.title}`))
    }
    return {
      title: trimTitle,
      author: author ?? '',
      authorLink: authorLink ?? '',
      permalink: `${page}#user-comment-${id}`,
    }
  })
}

const unionCommentSelect = {
  id: comment.id,
  createAt: comment.createdAt,
  updatedAt: comment.updatedAt,
  deleteAt: comment.deletedAt,
  content: comment.content,
  pageKey: comment.pageKey,
  userId: comment.userId,
  isVerified: comment.isVerified,
  ua: comment.ua,
  ip: comment.ip,
  rid: comment.rid,
  isCollapsed: comment.isCollapsed,
  isPending: comment.isPending,
  isPinned: comment.isPinned,
  voteUp: comment.voteUp,
  voteDown: comment.voteDown,
  rootId: comment.rootId,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  link: user.link,
  badgeName: user.badgeName,
  badgeColor: user.badgeColor,
}

export async function loadComments(session: AstroSession | undefined, key: string, title: string | null, offset: number): Promise<Comments | null> {
  await upsertPage(key, title)
  const pendingArray = session ? await isAdmin(session) ? [false, true] : [false] : [false]

  const counts = (await pool.db.select({ counts: count() }).from(comment).where(and(eq(comment.pageKey, key), inArray(comment.isPending, pendingArray))))[0].counts
  const rootCounts = (await pool.db.select({ counts: count() }).from(comment).where(and(eq(comment.pageKey, key), inArray(comment.isPending, pendingArray), eq(comment.rootId, 0n))))[0].counts
  const rootComments = await pool.db.select(unionCommentSelect)
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(and(eq(comment.pageKey, key), eq(comment.rootId, 0n), inArray(comment.isPending, pendingArray)))
    .limit(config.settings.comments.size)
    .orderBy(desc(comment.createdAt))
    .offset(offset)
  const childComments = await pool.db.select(unionCommentSelect)
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(and(eq(comment.pageKey, key), inArray(comment.isPending, pendingArray), inArray(comment.rootId, rootComments.map(c => c.id))))

  return {
    count: counts,
    roots_count: rootCounts,
    comments: [...rootComments, ...childComments],
  }
}

export async function increaseViews(key: string, title: string | null) {
  await upsertPage(key, title)
  if (import.meta.env.PROD) {
    await pool.db
      .update(page)
      .set({
        pv: sql`${page.pv} + 1`,
      })
      .where(eq(page.key, sql`${key}`))
  }
}

export async function approveComment(rid: string) {
  await pool.db.update(comment).set({ isPending: false }).where(eq(comment.id, BigInt(rid)))
  const c = await pool.db.select()
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .innerJoin(page, eq(comment.pageKey, page.key))
    .where(eq(comment.id, BigInt(rid)))
    .limit(1)
  if (c.length > 0) {
    sendApprovedComment(c[0].comment, c[0].user, c[0].page)
  }
}

export async function deleteComment(rid: string) {
  await pool.db.delete(comment).where(eq(comment.id, BigInt(rid)))
}

export async function createComment(commentReq: CommentReq, req: Request, clientAddress: string, session: AstroSession): Promise<ErrorResp | CommentAndUser> {
  // Check page key
  const p = await pool.db.select().from(page).where(eq(page.key, commentReq.page_key))
  if (p.length === 0) {
    return { msg: ErrorMessages.COMMENT_PAGE_NOT_FOUND }
  }

  // Upsert the comment user.
  const u = await createUser(commentReq.name, commentReq.email, commentReq.link || '')
  if (u === null) {
    return { msg: ErrorMessages.COMMENT_USER_CREATE_FAILED }
  }

  // Block the comment from the Admin
  const loginUser = await userSession(session)
  if (u.isAdmin) {
    if (loginUser === undefined) {
      return { msg: ErrorMessages.COMMENT_ADMIN_REQUIRED }
    }
  }

  // Ensure the commenter is the same as the login user
  else if (loginUser !== undefined && loginUser.email !== u.email) {
    return { msg: ErrorMessages.COMMENT_EMAIL_MISMATCH }
  }

  // Ensure the registered user should login to comment
  if (u.password !== undefined && u.password !== null && u.password !== '' && loginUser === undefined) {
    return { msg: ErrorMessages.COMMENT_LOGIN_REQUIRED }
  }

  // Query the existing comments for the user for deduplication.
  const historicalComments = await pool.db.select()
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .limit(10)
  if (historicalComments.find(c => c.comment.content === commentReq.content)) {
    return { msg: ErrorMessages.COMMENT_DUPLICATE }
  }

  // Update the comment user information
  await pool.db.update(user)
    .set({ lastUa: req.headers.get('User-Agent'), lastIp: clientAddress })
    .where(eq(user.id, u.id))

  // Calculate comment architecture
  let rootId = 0n
  if (commentReq.rid !== undefined && commentReq.rid !== 0) {
    const r = await pool.db.select({ rootId: comment.rootId }).from(comment).where(eq(comment.id, BigInt(commentReq.rid))).limit(1)
    if (r.length > 0 && r[0].rootId !== null && r[0].rootId !== 0n) {
      rootId = r[0].rootId
    }
    else {
      rootId = BigInt(commentReq.rid)
    }
  }

  // Should I bypass the check.
  const pendingStatus = await pool.db.select({ count: count() }).from(comment).where(and(eq(comment.userId, u.id), eq(comment.isPending, false)))
  const isPending = pendingStatus.length === 0 || pendingStatus[0].count === 0

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
  const res = await pool.db.insert(comment).values(newComment).returning()
  if (res.length === 0) {
    return { msg: ErrorMessages.COMMENT_CREATE_FAILED }
  }

  // Parse comment content into HTML.
  const cr = res[0]

  cr.content = await parseContent(cr.content || '该留言内容为空')

  const info = {
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
    sendNewComment(info, p[0])
  }
  if (info.rid !== 0) {
    const source = await pool.db.select()
      .from(comment)
      .innerJoin(user, eq(comment.userId, user.id))
      .where(eq(comment.id, BigInt(info.rid)))
      .limit(1)
    if (source.length > 0) {
      sendNewReply(source[0].user, source[0].comment, info, p[0])
    }
  }

  // Return the comment
  return info
}

export async function getCommentById(rid: string) {
  const r = await pool.db.select(unionCommentSelect)
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(eq(comment.id, BigInt(rid)))
    .limit(1)
  if (r.length === 0)
    return null
  return r[0]
}

export async function updateComment(rid: string, newContent: string) {
  // Update raw content and updated timestamp
  await pool.db.update(comment).set({ content: newContent }).where(eq(comment.id, BigInt(rid)))

  const r = await pool.db.select(unionCommentSelect)
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(eq(comment.id, BigInt(rid)))
    .limit(1)

  if (r.length === 0)
    return null

  // Parse content into HTML for rendering
  r[0].content = await parseContent(r[0].content || '该留言内容为空')

  return r[0]
}

export async function parseComments(comments: CommentAndUser[]): Promise<CommentItem[]> {
  const parsedComments = await Promise.all(
    comments.map(async comment => ({ ...comment, content: await parseContent(comment.content || '该留言内容为空') })),
  )
  const childComments = _.groupBy(
    parsedComments.filter(comment => !rootCommentFilter(comment)),
    c => c.rid,
  )

  return parsedComments.filter(rootCommentFilter).map(comment => commentItems(comment, childComments))
}

function rootCommentFilter(comment: CommentAndUser): boolean {
  return comment.rid === 0 || comment.rid === null || comment.rid === undefined
}

function commentItems(comment: CommentAndUser, childComments: _.Dictionary<CommentAndUser[]>): CommentItem {
  const children = childComments[`${comment.id}`]
  if (children === undefined) {
    return comment
  }

  return { ...comment, children: children.map(child => commentItems(child, childComments)) }
}
