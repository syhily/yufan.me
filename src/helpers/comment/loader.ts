import type { CommentAndUser, CommentItem, CommentReq, CommentResp, Comments, ErrorResp, LatestComment } from '@/helpers/comment/types'
import type { NewPage, Page } from '@/helpers/db/types'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import _ from 'lodash'
import { db } from '@/helpers/db/pool'
import { queryUser } from '@/helpers/db/query'
import { comment, page, user } from '@/helpers/db/schema'
import { parseContent } from '@/helpers/markdown'
import { urlJoin } from '@/helpers/tools'
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

// Access the artalk in internal docker host when it was deployed on zeabur.
const server = ''

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

  const counts = (await db.select({ counts: count() }).from(comment).where(eq(comment.pageKey, key)))[0].counts
  const rootCounts = (await db.select({ counts: count() }).from(comment).where(and(eq(comment.pageKey, key), eq(comment.rootId, 0n))))[0].counts
  const rootComments = await db.select(unionCommentSelect)
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(and(eq(comment.pageKey, key), eq(comment.rootId, 0n)))
    .limit(options.settings.comments.size)
    .orderBy(desc(comment.createdAt))
    .offset(offset)
  const childComments = await db.select(unionCommentSelect)
    .from(comment)
    .innerJoin(user, eq(comment.userId, user.id))
    .where(and(eq(comment.pageKey, key), inArray(comment.rootId, rootComments.map(c => c.id))))

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
      voteUp: sql`${page.voteUp} + 1`,
    })
    .where(eq(page.key, sql`${key}`))
}

export async function createComment(commentReq: CommentReq, req: Request, clientAddress: string): Promise<ErrorResp | CommentResp> {
  const user = await queryUser(commentReq.email)
  if (user !== null && user.name !== null) {
    // Replace the comment user name for avoiding the duplicated users creation.
    // We may add the commenter account management in the future.
    commentReq.name = user.name
  }

  // Query the existing comments for the user.
  const historicalParams = new URLSearchParams({
    email: commentReq.email,
    page_key: commentReq.page_key,
    site_name: options.title,
    flat_mode: 'true',
    limit: '5',
    sort_by: 'date_desc',
    type: 'all',
  }).toString()
  const historicalComments = await fetch(urlJoin(server, `/api/v2/comments?${historicalParams}`), {
    method: 'GET',
    headers: {
      'Content-type': 'application/json; charset=UTF-8',
    },
  })
    .then(async resp => (await resp.json()).comments as Comment[])
    .catch((e) => {
      console.error(e)
      return new Array<Comment>()
    })

  if (historicalComments.find(comment => comment.content === commentReq.content)) {
    return { msg: '重复评论，你已经有了相同的留言，如果在页面看不到，说明它正在等待站长审核。' }
  }

  const response = await fetch(urlJoin(server, '/api/v2/comments'), {
    method: 'POST',
    headers: {
      'User-Agent': req.headers.get('User-Agent') || 'node',
      'X-Forwarded-For': clientAddress,
      'Content-type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ ...commentReq, site_name: options.title, rid: commentReq.rid ? Number(commentReq.rid) : 0 }),
  }).catch((e) => {
    console.error(e)
    return null
  })

  if (response === null) {
    return { msg: '服务端异常，评论创建失败。' }
  }

  if (!response.ok) {
    return (await response.json()) as ErrorResp
  }

  // Parse comment content.
  const commentResp = (await response.json()) as CommentResp
  commentResp.content = await parseContent(commentResp.content || '该留言内容为空')

  return commentResp
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
