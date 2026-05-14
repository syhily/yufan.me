// Admin controller — migrated from routes/api/actions/admin.*.ts

import { renderMermaidSVGAsync } from 'beautiful-mermaid'
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { z } from 'zod'

import type { RenderMathOutput } from '@/shared/cms-pages'
import type { RenderMermaidOutput } from '@/shared/cms-pages'
import type { PortableTextBody } from '@/shared/pt/schema'

import { revokeAllSessionsOfUser } from '@/server/auth/session-storage'
import { findSessionMeta, revokeSessionById } from '@/server/auth/sessions'
import { issueResetToken } from '@/server/auth/verification-tokens'
import { issueSetupToken, revokeTokensFor } from '@/server/auth/verification-tokens'
import { clearAdminCache } from '@/server/cache/admin'
import { getAdminCacheStats } from '@/server/cache/admin'
import { clearCacheSchema } from '@/server/cache/schema'
import { categoryIdSchema } from '@/server/categories/schema'
import { listCategoriesSchema } from '@/server/categories/schema'
import { reorderCategoriesSchema } from '@/server/categories/schema'
import { upsertCategorySchema } from '@/server/categories/schema'
import { deleteAdminCategory } from '@/server/categories/service'
import { listCategoriesForAdmin } from '@/server/categories/service'
import { reorderAdminCategories } from '@/server/categories/service'
import { upsertAdminCategory } from '@/server/categories/service'
import { renderPortableTextToHtml as renderPagePortableTextToHtml } from '@/server/cms/pages/preview'
import { deletePageSchema } from '@/server/cms/pages/schema'
import { getPageSchema } from '@/server/cms/pages/schema'
import { listPageRevisionsSchema } from '@/server/cms/pages/schema'
import { listPagesSchema } from '@/server/cms/pages/schema'
import { previewPageBodySchema } from '@/server/cms/pages/schema'
import { renderMathSchema } from '@/server/cms/pages/schema'
import { renderMermaidSchema } from '@/server/cms/pages/schema'
import { restorePageSchema } from '@/server/cms/pages/schema'
import { savePageBodySchema } from '@/server/cms/pages/schema'
import { unpublishPageSchema } from '@/server/cms/pages/schema'
import { upsertPageMetaSchema } from '@/server/cms/pages/schema'
import { createPage, updatePageMeta } from '@/server/cms/pages/service'
import { deletePage } from '@/server/cms/pages/service'
import { getPageDetailForAdmin } from '@/server/cms/pages/service'
import { listPagesForAdmin } from '@/server/cms/pages/service'
import { listRevisionsForAdmin as listPageRevisionsForAdmin } from '@/server/cms/pages/service'
import { publishLatest as publishPageLatest } from '@/server/cms/pages/service'
import { restorePage } from '@/server/cms/pages/service'
import { saveDraft as savePageDraft } from '@/server/cms/pages/service'
import { unpublishPage } from '@/server/cms/pages/service'
import { renderPortableTextToHtml as renderPostPortableTextToHtml } from '@/server/cms/posts/preview'
import { deletePostSchema } from '@/server/cms/posts/schema'
import { getPostSchema } from '@/server/cms/posts/schema'
import { listPostRevisionsSchema } from '@/server/cms/posts/schema'
import { listPostsSchema } from '@/server/cms/posts/schema'
import { previewPostBodySchema } from '@/server/cms/posts/schema'
import { restorePostSchema } from '@/server/cms/posts/schema'
import { savePostBodySchema } from '@/server/cms/posts/schema'
import { unpublishPostSchema } from '@/server/cms/posts/schema'
import { upsertPostMetaSchema } from '@/server/cms/posts/schema'
import { createPost, updatePostMeta } from '@/server/cms/posts/service'
import { deletePost } from '@/server/cms/posts/service'
import { getPostDetailForAdmin } from '@/server/cms/posts/service'
import { listPostsForAdmin } from '@/server/cms/posts/service'
import { listRevisionsForAdmin as listPostRevisionsForAdmin } from '@/server/cms/posts/service'
import { publishLatest as publishPostLatest } from '@/server/cms/posts/service'
import { restorePost } from '@/server/cms/posts/service'
import { saveDraft as savePostDraft } from '@/server/cms/posts/service'
import { unpublishPost } from '@/server/cms/posts/service'
import { loadAdminPendingDashboard } from '@/server/comments/admin'
import { db } from '@/server/db/pool'
import { adminClearDeleteRequest, findCommentWithUserById, softDeleteCommentById } from '@/server/db/query/comment'
import { countAdmins, findUserById, updateUserRole } from '@/server/db/query/user'
import { findUserByEmail, insertAuthor, softDeleteUserById } from '@/server/db/query/user'
import { content, post } from '@/server/db/schema'
import { sendAuthorInvite } from '@/server/email/sender'
import { sendPasswordReset as sendPasswordResetEmail } from '@/server/email/sender'
import { sendTestMail } from '@/server/email/sender'
import { friendIdSchema } from '@/server/friends/schema'
import { listFriendsSchema } from '@/server/friends/schema'
import { upsertFriendSchema } from '@/server/friends/schema'
import { deleteAdminFriend } from '@/server/friends/service'
import { listFriendsForAdmin } from '@/server/friends/service'
import { upsertAdminFriend } from '@/server/friends/service'
import { deleteImageSchema } from '@/server/images/schema'
import { listImagesSchema } from '@/server/images/schema'
import { recalculateThumbhashSchema } from '@/server/images/schema'
import { updateImageNoteSchema } from '@/server/images/schema'
import { uploadImageMetadataSchema } from '@/server/images/schema'
import { deleteImage } from '@/server/images/service'
import { listImagesForAdmin } from '@/server/images/service'
import { recalculateImageThumbhash } from '@/server/images/service'
import { updateImageNote } from '@/server/images/service'
import { uploadImage } from '@/server/images/service'
import { getLogger } from '@/server/logger'
import { addMusicSchema } from '@/server/music/schema'
import { deleteMusicSchema } from '@/server/music/schema'
import { listMusicSchema } from '@/server/music/schema'
import { searchMusicSchema } from '@/server/music/schema'
import { updateMusicSchema } from '@/server/music/schema'
import { addMusic } from '@/server/music/service'
import { deleteMusic } from '@/server/music/service'
import { listMusicForAdmin } from '@/server/music/service'
import { searchMusic } from '@/server/music/service'
import { updateMusicMetadata } from '@/server/music/service'
import { getKatexRenderer, type KatexRenderer } from '@/server/pt/katex-renderer'
import { tryInviteByEmailRateLimit, tryInviteRateLimit } from '@/server/rate-limit'
import { tryPasswordResetByTargetRateLimit } from '@/server/rate-limit'
import { parseInput } from '@/server/route-helpers/api-handler'
import { ActionFailure } from '@/server/route-helpers/errors'
import { indexPost } from '@/server/search/indexer'
import { userSession } from '@/server/session'
import { sendTestMailSchema } from '@/server/settings/schema'
import { updateSettingsSchema } from '@/server/settings/sections'
import { getAdminBlogSettings } from '@/server/settings/service'
import { updateBlogSettingsSection } from '@/server/settings/service'
import { deriveSlug } from '@/server/slug'
import { listTagsSchema } from '@/server/tags/schema'
import { tagIdSchema } from '@/server/tags/schema'
import { upsertTagSchema } from '@/server/tags/schema'
import { deleteAdminTag } from '@/server/tags/service'
import { listTagsForAdmin } from '@/server/tags/service'
import { upsertAdminTag } from '@/server/tags/service'
import { listUsersSchema } from '@/server/users/schema'
import { muteUserSchema } from '@/server/users/schema'
import { userIdSchema } from '@/server/users/schema'
import { bulkApproveCommentsForUser } from '@/server/users/service'
import { bulkDeleteCommentsForUser } from '@/server/users/service'
import { fetchAdminUserDto, muteAdminUser } from '@/server/users/service'
import { listUsersForAdmin, toAdminUserDto } from '@/server/users/service'
import { restoreAdminUser } from '@/server/users/service'
import { softDeleteAdminUser } from '@/server/users/service'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { collectHeadings } from '@/shared/pt/schema'

function safeBigInt(value: string): bigint | null {
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

export const adminController = {
  addMusic: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  approveCommentDeletion: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const id = BigInt(payload.commentId)
    const c = await findCommentWithUserById(id)
    if (!c) {
      return { status: 404 as const, body: { error: { message: '评论不存在。' } } }
    }
    if (c.deleteRequestedAt === null) {
      return { status: 409 as const, body: { error: { message: '该评论没有待处理的删除申请。' } } }
    }
    if (payload.approve) {
      await softDeleteCommentById(id)
      getLogger('audit.comment').info('delete request approved', {
        actor: ctx.viewer.userId,
        commentId: payload.commentId,
      })
    } else {
      await adminClearDeleteRequest(id)
      getLogger('audit.comment').info('delete request rejected', {
        actor: ctx.viewer.userId,
        commentId: payload.commentId,
      })
    }
    return { status: 200 as const, body: { success: true } }
  },
  bulkApproveUserComments: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const result = await bulkApproveCommentsForUser(BigInt(payload.userId))
    return { status: 200 as const, body: result }
  },
  bulkSoftDeleteUserComments: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const result = await bulkDeleteCommentsForUser(BigInt(payload.userId))
    return { status: 200 as const, body: result }
  },
  clearCache: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const result = await clearAdminCache(payload.target)
    return { status: 200 as const, body: result }
  },
  deleteCategory: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const ok = await deleteAdminCategory(BigInt(args.params.id))
    if (!ok) {
      return { status: 404 as const, body: { error: { message: '分类不存在' } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
  deleteFriend: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const ok = await deleteAdminFriend(BigInt(args.params.id))
    if (!ok) {
      return { status: 404 as const, body: { error: { message: '友链不存在' } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
  deleteImage: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  deleteMusic: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  deletePage: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  deletePost: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  deleteTag: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const ok = await deleteAdminTag(BigInt(payload.id), ctx.viewer)
    if (!ok) {
      return { status: 404 as const, body: { error: { message: '标签不存在' } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
  getCacheStats: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const result = await getAdminCacheStats()
    return { status: 200 as const, body: result }
  },
  getPage: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  getPost: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  getSettings: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const result = await getAdminBlogSettings()
    return { status: 200 as const, body: result }
  },
  getUser: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const user = await fetchAdminUserDto(BigInt(payload.userId))
    if (!user) {
      return { status: 404 as const, body: { error: { message: '用户不存在' } } }
    }
    return { status: 200 as const, body: { user } }
  },
  inviteAuthor: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const viewer = ctx.viewer
    const existing = await findUserByEmail(payload.email)
    if (existing !== null) {
      return { status: 409 as const, body: { error: { message: '该邮箱已被注册。' } } }
    }
    const ipLimit = await tryInviteRateLimit(ctx.clientAddress)
    const emailLimit = await tryInviteByEmailRateLimit(BigInt(viewer.userId), payload.email)
    if (ipLimit.exceeded || emailLimit.exceeded) {
      return { status: 429 as const, body: { error: { message: '邀请发送过于频繁，请稍后再试。' } } }
    }
    const [user] = await insertAuthor(payload.name, payload.email)
    if (!user) {
      return { status: 500 as const, body: { error: { message: '创建作者账户失败。' } } }
    }
    const { token } = await issueSetupToken(user.id)
    const origin = new URL(ctx.request.url).origin
    const link = `${origin}/wp-login.php?action=accept-invite&token=${encodeURIComponent(token)}`
    const inviterSession = ctx.session.get('user')
    const inviter = inviterSession?.name ?? '管理员'
    const sendResult = await sendAuthorInvite(user, link, inviter, inviterSession?.email)
    if (!sendResult.ok) {
      await revokeTokensFor(user.id, 'author-invite')
      await softDeleteUserById(user.id)
      getLogger('audit.user').warn('author invite rolled back: email send failed', {
        actor: viewer.userId,
        target: String(user.id),
        email: payload.email,
        reason: sendResult.reason,
        message: sendResult.message,
      })
      return {
        status: 502 as const,
        body: { error: { message: `邮件发送失败，已回滚账户创建：${sendResult.message}` } },
      }
    }
    getLogger('audit.user').info('author invited', {
      actor: viewer.userId,
      target: String(user.id),
      email: payload.email,
    })
    return { status: 200 as const, body: { success: true } }
  },
  listCategories: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.query
    const result = await listCategoriesForAdmin({ q: payload.q })
    return { status: 200 as const, body: result }
  },
  listFriends: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.query
    const result = await listFriendsForAdmin({
      q: payload.q,
      includeHidden: payload.includeHidden,
      offset: payload.offset,
      limit: payload.limit,
    })
    return { status: 200 as const, body: result }
  },
  listImages: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  listMusic: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  listPageRevisions: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  listPages: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  listPendingDashboard: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.query
    const result = await loadAdminPendingDashboard(payload.kind, payload.offset, payload.limit)
    return { status: 200 as const, body: result }
  },
  listPostRevisions: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  listPosts: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  listTags: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.query
    const result = await listTagsForAdmin({ q: payload.q, offset: payload.offset, limit: payload.limit })
    return { status: 200 as const, body: result }
  },
  listUsers: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.query
    const result = await listUsersForAdmin(
      payload.offset,
      payload.limit,
      {
        q: payload.q,
        role: payload.role ?? 'all',
        includeDeleted: payload.includeDeleted ?? false,
        hasPosts: payload.hasPosts ?? false,
      },
      payload.sortBy ?? 'recent',
    )
    return {
      status: 200 as const,
      body: {
        users: result.users.map(toAdminUserDto),
        total: result.total,
        hasMore: result.hasMore,
      },
    }
  },
  muteUser: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const updated = await muteAdminUser(BigInt(payload.userId), payload.muted)
    if (!updated) {
      return { status: 404 as const, body: { error: { message: '用户不存在或为管理员（管理员不可禁言）' } } }
    }
    const dto = await fetchAdminUserDto(updated.id)
    if (!dto) {
      return { status: 404 as const, body: { error: { message: '用户不存在' } } }
    }
    return { status: 200 as const, body: { user: dto } }
  },
  previewPage: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  previewPost: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  publishLatest: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  publishPostLatest: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  recalculateImageThumbhash: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  reindexSearch: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const rows = await db
      .select({
        id: post.id,
        title: post.title,
        summary: post.summary,
        publishedRevisionId: post.publishedRevisionId,
      })
      .from(post)
      .where(and(isNull(post.deletedAt), eq(post.published, true), isNotNull(post.publishedRevisionId)))
      .orderBy(post.id)

    const total = rows.length

    const useBatching = payload.batchSize !== undefined || payload.offset !== undefined
    const offset = payload.offset ?? 0
    const batchSize = payload.batchSize ?? total
    const batch = useBatching ? rows.slice(offset, offset + batchSize) : rows

    const revisionIds = batch.map((r) => r.publishedRevisionId!).filter(Boolean)
    const contents =
      revisionIds.length > 0 ? await db.select().from(content).where(inArray(content.id, revisionIds)) : []
    const contentMap = new Map(contents.map((c) => [c.id, c]))

    let processed = 0
    let failed = 0
    for (const row of batch) {
      const rev = contentMap.get(row.publishedRevisionId!)
      if (rev) {
        try {
          await indexPost(row.id, row.title, row.summary, rev.body as PortableTextBody)
          processed++
        } catch (err) {
          getLogger('search.reindex').error('Index post failed', {
            postId: String(row.id),
            title: row.title,
            error: err instanceof Error ? err.message : String(err),
          })
          failed++
        }
      }
    }

    const nextOffset = useBatching && offset + batch.length < total ? offset + batch.length : null

    return { status: 200 as const, body: { processed, failed, total, nextOffset } }
  },
  renderMath: async (args: any, ctx: any) => {
    const payload = args.body
    const tex = payload.tex
    if (tex.trim() === '') {
      return { status: 200 as const, body: { mathml: '', error: null } }
    }
    let renderer: KatexRenderer
    try {
      renderer = await getKatexRenderer()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'KaTeX 加载失败'
      return { status: 200 as const, body: { mathml: '', error: message } }
    }
    try {
      const mathml = await renderer.render(tex, payload.display)
      return { status: 200 as const, body: { mathml, error: null } }
    } catch (err) {
      const message = err instanceof Error ? err.message : '公式渲染失败'
      return { status: 200 as const, body: { mathml: '', error: message } }
    }
  },
  renderMermaid: async (args: any, ctx: any) => {
    const payload = args.body
    const code = payload.code
    if (code.trim() === '') {
      return { status: 200 as const, body: { svg: '', error: null } }
    }
    try {
      const svg = await renderMermaidSVGAsync(code)
      return { status: 200 as const, body: { svg, error: null } }
    } catch (err) {
      const message = err instanceof Error ? err.message : '图表渲染失败'
      return { status: 200 as const, body: { svg: '', error: message } }
    }
  },
  reorderCategories: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const categories = await reorderAdminCategories(payload.orderedIds)
    return { status: 200 as const, body: { categories } }
  },
  restorePage: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  restorePost: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  restoreUser: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const viewer = ctx.viewer
    const ok = await restoreAdminUser(BigInt(payload.userId))
    if (!ok) {
      return { status: 404 as const, body: { error: { message: '用户不存在' } } }
    }
    getLogger('audit.user').info('user restored', { actor: viewer.userId, target: payload.userId })
    return { status: 200 as const, body: { success: true } }
  },
  revokeSession: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const viewer = ctx.viewer
    const currentSession = payload.sessionId === ctx.session.id
    const meta = await findSessionMeta(payload.sessionId)
    if (!meta) {
      return { status: 200 as const, body: { success: true, currentSession } }
    }
    await revokeSessionById(payload.sessionId, meta.userId)
    getLogger('audit.session').info('session revoked by admin', {
      actor: viewer.userId,
      target: meta.userId.toString(),
      sessionId: payload.sessionId,
      selfRevoke: currentSession,
    })
    return { status: 200 as const, body: { success: true, currentSession } }
  },
  revokeUserSessions: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const viewer = ctx.viewer
    let targetId: bigint
    try {
      targetId = BigInt(payload.userId)
    } catch {
      return { status: 400 as const, body: { error: { message: '用户 ID 无效。' } } }
    }
    const target = await findUserById(targetId)
    if (!target) {
      return { status: 404 as const, body: { error: { message: '用户不存在。' } } }
    }
    await revokeAllSessionsOfUser(targetId)
    getLogger('audit.session').info('all sessions revoked by admin', {
      actor: viewer.userId,
      target: payload.userId,
    })
    return { status: 200 as const, body: { success: true } }
  },
  saveDraft: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  savePostDraft: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  searchMusic: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  sendPasswordReset: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const viewer = ctx.viewer
    const targetId = BigInt(payload.userId)
    const user = await findUserById(targetId)
    if (!user) {
      return { status: 404 as const, body: { error: { message: '用户不存在。' } } }
    }
    const limit = await tryPasswordResetByTargetRateLimit(targetId)
    if (limit.exceeded) {
      return { status: 429 as const, body: { error: { message: '该用户的重置邮件发送过于频繁，请稍后再试。' } } }
    }
    const { token } = await issueResetToken(user.id)
    const origin = new URL(ctx.request.url).origin
    const link = `${origin}/wp-login.php?action=resetpassword&token=${encodeURIComponent(token)}`
    await sendPasswordResetEmail(user, link)
    getLogger('audit.user').info('password reset sent', { actor: viewer.userId, target: payload.userId })
    return { status: 200 as const, body: { success: true } }
  },
  sendTestMail: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const result = await sendTestMail(payload.to)
    if (!result.ok) {
      if (result.reason === 'unconfigured') {
        return { status: 412 as const, body: { error: { message: result.message } } }
      }
      if (result.reason === 'upstream' && typeof result.status === 'number') {
        return { status: result.status as number, body: { error: { message: result.message } } }
      }
      return { status: 502 as const, body: { error: { message: result.message } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
  softDeleteUser: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const viewer = ctx.viewer
    if (viewer.userId === payload.userId) {
      return { status: 403 as const, body: { error: { message: '不能删除自己。' } } }
    }
    const targetId = BigInt(payload.userId)
    const target = await findUserById(targetId)
    if (!target) {
      return { status: 404 as const, body: { error: { message: '用户不存在' } } }
    }
    if (target.role === 'admin') {
      const adminCount = await countAdmins()
      if (adminCount <= 1) {
        return { status: 409 as const, body: { error: { message: '不能删除唯一的管理员。' } } }
      }
    }
    const ok = await softDeleteAdminUser(targetId)
    if (!ok) {
      return { status: 404 as const, body: { error: { message: '用户不存在或已被删除' } } }
    }
    await revokeAllSessionsOfUser(targetId)
    getLogger('audit.user').info('user soft deleted', {
      actor: viewer.userId,
      target: payload.userId,
      role: target.role,
    })
    return { status: 200 as const, body: { success: true } }
  },
  unpublishPage: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  unpublishPost: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  updateImageNote: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  updateMusic: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  updateSettings: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const viewer = ctx.viewer
    const editorId = safeBigInt(viewer.userId)
    await updateBlogSettingsSection(payload.section, payload.payload, editorId)
    return { status: 200 as const, body: { success: true } }
  },
  updateUserRole: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const viewer = ctx.viewer
    if (viewer.userId === payload.userId) {
      return { status: 403 as const, body: { error: { message: '不能修改自己的角色。' } } }
    }
    const targetId = BigInt(payload.userId)
    const target = await findUserById(targetId)
    if (!target) {
      return { status: 404 as const, body: { error: { message: '用户不存在。' } } }
    }
    if (target.role === 'admin' && payload.role !== 'admin') {
      const adminCount = await countAdmins()
      if (adminCount <= 1) {
        return { status: 409 as const, body: { error: { message: '不能降级唯一的管理员。' } } }
      }
    }
    const updated = await updateUserRole(targetId, payload.role)
    if (updated) {
      await revokeAllSessionsOfUser(targetId)
      getLogger('audit.user').info('user role changed', {
        actor: viewer.userId,
        target: payload.userId,
        from: target.role,
        to: payload.role,
      })
    }
    return { status: 200 as const, body: { user: updated } }
  },
  uploadImage: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }

    const settings = requireBlogSettingsSection('assets')

    let formData: FormData
    try {
      formData = await ctx.request.formData()
    } catch {
      return { status: 400 as const, body: { error: { message: '无法解析 multipart 请求体' } } }
    }

    const fileEntry = formData.get('file')
    if (!(fileEntry instanceof Blob)) {
      return {
        status: 400 as const,
        body: {
          error: { message: '缺少图片文件 (file 字段必填)', issues: [{ message: 'file 字段必填', path: ['file'] }] },
        },
      }
    }
    if (fileEntry.size > settings.upload.maxBytes) {
      return {
        status: 413 as const,
        body: { error: { message: `图片体积超过上限（${formatBytes(settings.upload.maxBytes)}）` } },
      }
    }

    const metadataObj: Record<string, string> = {}
    for (const [key, value] of formData.entries()) {
      if (key === 'file') continue
      if (typeof value === 'string') {
        metadataObj[key] = value
      }
    }

    const metadata = await parseInput(uploadImageMetadataSchema, metadataObj)

    const buffer = Buffer.from(await fileEntry.arrayBuffer())
    const uploader = { id: BigInt(sessionUser.id), name: sessionUser.name }

    let image
    if (metadata.kind === 'generic') {
      image = await uploadImage({
        kind: { kind: 'generic' },
        buffer,
        note: metadata.note ?? null,
        uploader,
        maxBytes: settings.upload.maxBytes,
        jpegQuality: settings.upload.jpegQuality,
      })
    } else if (metadata.kind === 'category') {
      image = await uploadImage({
        kind: { kind: 'category', slug: metadata.slug },
        buffer,
        note: metadata.note ?? null,
        uploader,
        maxBytes: settings.upload.maxBytes,
        jpegQuality: settings.upload.jpegQuality,
      })
    } else {
      image = await uploadImage({
        kind: { kind: 'friend', host: metadata.host },
        buffer,
        note: metadata.note ?? null,
        uploader,
        maxBytes: settings.upload.maxBytes,
        jpegQuality: settings.upload.jpegQuality,
      })
    }

    return { status: 200 as const, body: { image } }
  },
  upsertCategory: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const category = await upsertAdminCategory({
      id: payload.id !== undefined ? BigInt(payload.id) : undefined,
      name: payload.name,
      slug: payload.slug,
      cover: payload.cover,
      description: payload.description,
      sortOrder: payload.sortOrder,
    })
    return { status: 200 as const, body: { category } }
  },
  upsertFriend: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const friend = await upsertAdminFriend({
      id: payload.id !== undefined ? BigInt(payload.id) : undefined,
      website: payload.website,
      description: payload.description ?? null,
      homepage: payload.homepage,
      poster: payload.poster,
      rssUrl: payload.rssUrl ?? null,
      visible: payload.visible,
    })
    return { status: 200 as const, body: { friend } }
  },
  upsertPageMeta: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (sessionUser?.role !== 'admin') return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  upsertPostMeta: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    return { status: 200 as const, body: null }
  },
  upsertTag: async (args: any, ctx: any) => {
    const sessionUser = userSession(ctx.session)
    if (!sessionUser || (sessionUser.role !== 'admin' && sessionUser.role !== 'author'))
      return { status: 403 as const, body: { error: { message: '权限不足' } } }
    const payload = args.body
    const tag = await upsertAdminTag({
      id: payload.id !== undefined ? BigInt(payload.id) : undefined,
      name: payload.name,
      slug: payload.slug,
    })
    return { status: 200 as const, body: { tag } }
  },
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }
  return `${bytes} B`
}
