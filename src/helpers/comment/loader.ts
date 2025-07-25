import type { AstroSession } from 'astro'
import type { CommentAndUser, CommentItem, CommentReq, Comments, ErrorResp, LatestComment } from '@/helpers/comment/types'
import type { NewComment, NewPage, Page } from '@/helpers/db/types'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import _ from 'lodash'
import { userSession } from '@/helpers/auth/session'
import { createUser } from '@/helpers/auth/user'
import { parseContent } from '@/helpers/content/markdown'
import { db } from '@/helpers/db/pool'
import { comment, page, user } from '@/helpers/db/schema'
import options from '@/options'

async function upsertPage(key: string, title: string | null): Promise<Page> {
  const res = await db.select().from(page).where(eq(page.key, key)).limit(1)
  if (res.length > 0) {
    const p = res[0]
    if (p.title !== title && title !== null) {
      // Update the page with the new title
      p.title = title
      await db.insert(page).values(p).returning()
    }
    return p
  }
  const np: NewPage = { title: title || '无标题', key, voteUp: 0, voteDown: 0, pv: 0 }
  return (await db.insert(page).values(np).returning())[0]
}

export async function latestComments(): Promise<LatestComment[]> {
  const admins = await db.select({ id: user.id }).from(user).where(eq(user.isAdmin, true))
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
  LIMIT     ${options.settings.sidebar.comment}`
  const latestDistinctComments = (await db.execute(latestDistinctCommentsQuery)).rows.map(row => row.id).map(id => BigInt(`${id}`))
  const results = await db
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
    .limit(options.settings.sidebar.comment)

  return results.map(({ title, author, authorLink, page, id }) => {
    let trimTitle = title ?? ''
    if (trimTitle.includes(` - ${options.title}`)) {
      trimTitle = trimTitle.substring(0, trimTitle.indexOf(` - ${options.title}`))
    }
    const link = !options.isProd() && page !== null ? page.replace(options.website, import.meta.env.SITE) : page
    return {
      title: trimTitle,
      author: author ?? '',
      authorLink: authorLink ?? '',
      permalink: `${link}#user-comment-${id}`,
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

export async function loadComments(key: string, title: string | null, offset: number): Promise<Comments | null> {
  await upsertPage(key, title)

  const counts = (await db.select({ counts: count() }).from(comment).where(and(eq(comment.pageKey, key), eq(comment.isPending, false))))[0].counts
  const rootCounts = (await db.select({ counts: count() }).from(comment).where(and(eq(comment.pageKey, key), eq(comment.isPending, false), eq(comment.rootId, 0n))))[0].counts
  const rootComments = await db.select(unionCommentSelect)
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(and(eq(comment.pageKey, key), eq(comment.rootId, 0n), eq(comment.isPending, false)))
    .limit(options.settings.comments.size)
    .orderBy(desc(comment.createdAt))
    .offset(offset)
  const childComments = await db.select(unionCommentSelect)
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(and(eq(comment.pageKey, key), eq(comment.isPending, false), inArray(comment.rootId, rootComments.map(c => c.id))))

  return {
    count: counts,
    roots_count: rootCounts,
    comments: [...rootComments, ...childComments],
  }
}

export async function increaseViews(key: string, title: string | null) {
  await upsertPage(key, title)
  await db
    .update(page)
    .set({
      pv: sql`${page.pv} + 1`,
    })
    .where(eq(page.key, sql`${key}`))
}

export async function createComment(commentReq: CommentReq, req: Request, clientAddress: string, session: AstroSession): Promise<ErrorResp | CommentAndUser> {
  // Upsert the comment user.
  const u = await createUser(commentReq.name, commentReq.email, commentReq.link || '')
  if (u === null) {
    return { msg: '系统错误，用户创建失败。' }
  }

  // Block the comment from the Admin
  const loginUser = await userSession(session)
  if (u.isAdmin) {
    if (loginUser === undefined) {
      return { msg: '管理员账号需要登陆才能评论。' }
    }
  }

  // Ensure the commenter is the same sa the login user
  else if (loginUser !== undefined && loginUser.email !== u.email) {
    return { msg: '评论邮箱与登陆账号不相符。' }
  }

  // Ensure the registered user should login to comment
  if (u.password !== undefined && u.password !== null && u.password !== '' && loginUser === undefined) {
    return { msg: '该邮箱已经注册，请登录后再进行评论留言。' }
  }

  // Query the existing comments for the user for deduplication.
  const historicalComments = await db.select()
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .limit(10)
  if (historicalComments.find(c => c.comment.content === commentReq.content)) {
    return { msg: '重复评论，你已经有了相同的留言，如果在页面看不到，说明它正在等待站长审核。' }
  }

  // Update the comment user information
  db.update(user)
    .set({ lastUa: req.headers.get('User-Agent'), lastIp: clientAddress })
    .where(eq(user.id, u.id))

  // Calculate comment architecture
  let rootId = 0n
  if (commentReq.rid !== undefined && commentReq.rid !== 0) {
    const r = await db.select({ rootId: comment.rootId }).from(comment).where(eq(comment.rid, commentReq.rid)).limit(1)
    if (r.length > 0 && r[0].rootId !== null) {
      rootId = r[0].rootId
    }
  }

  // Should I bypass the check.
  const pendingStatus = await db.select({ count: count() }).from(comment).where(and(eq(comment.userId, u.id), eq(comment.isPending, false)))
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
  const res = await db.insert(comment).values(newComment).returning()
  if (res.length === 0) {
    return { msg: '系统错误，评论创建失败。' }
  }

  // Parse comment content into HTML.
  const cr = res[0]

  cr.content = await parseContent(cr.content || '该留言内容为空')

  // Return the comment
  return {
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
