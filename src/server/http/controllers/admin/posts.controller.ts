import type { ContractImpl } from '@/server/http/ts-rest-adapter'

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
import { userSession } from '@/server/session'
import { deriveSlug } from '@/server/slug'
import { adminPostsContract } from '@/shared/contracts/admin/posts'
import { collectHeadings } from '@/shared/pt/schema'

export const adminPostsController = {
  // TODO: add `satisfies ContractImpl<typeof adminPostsContract>` once all response schemas are strict
  listPosts: async (args: any, ctx: any) => {
    const result = await listPostsForAdmin(
      {
        q: args.query.q,
        deletedStatus: args.query.deletedStatus,
        offset: args.query.offset,
        limit: args.query.limit,
        category: args.query.category,
        tag: args.query.tag,
        published: args.query.published,
        visible: args.query.visible,
        sortBy: args.query.sortBy,
        sortOrder: args.query.sortOrder,
        authorId: args.query.authorId,
      },
      ctx.viewer,
    )
    return { status: 200 as const, body: result }
  },
  getPost: async (args: any, ctx: any) => {
    const detail = await getPostDetailForAdmin(BigInt(args.params.id), ctx.viewer)
    if (detail === null) {
      return { status: 404 as const, body: { error: { message: '文章不存在或已被删除。' } } }
    }
    return { status: 200 as const, body: detail }
  },
  deletePost: async (args: any, ctx: any) => {
    const result = await deletePost(BigInt(args.params.id), ctx.viewer)
    if (!result.deleted) {
      return { status: 404 as const, body: { error: { message: '文章不存在或已被删除。' } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
  restorePost: async (args: any, ctx: any) => {
    const result = await restorePost(BigInt(args.body.id), ctx.viewer)
    if (!result.restored) {
      return { status: 404 as const, body: { error: { message: '文章不存在或未被删除。' } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
  unpublishPost: async (args: any, ctx: any) => {
    const post = await unpublishPost(BigInt(args.body.id), ctx.viewer)
    return { status: 200 as const, body: { post } }
  },
  savePostDraft: async (args: any, ctx: any) => {
    const result = await savePostDraft(
      {
        postId: BigInt(args.body.id),
        body: args.body.body,
        expectedClientRevisionToken: args.body.expectedClientRevisionToken ?? undefined,
        force: args.body.force,
        authorId: BigInt(ctx.viewer.userId),
      },
      ctx.viewer,
    )
    return { status: 200 as const, body: result }
  },
  publishPostLatest: async (args: any, ctx: any) => {
    const result = await publishPostLatest(
      {
        postId: BigInt(args.body.id),
        body: args.body.body,
        expectedClientRevisionToken: args.body.expectedClientRevisionToken ?? undefined,
        force: args.body.force,
        authorId: BigInt(ctx.viewer.userId),
        publishedAt: args.body.publishedAt !== undefined ? new Date(args.body.publishedAt) : undefined,
      },
      ctx.viewer,
    )
    return { status: 200 as const, body: result }
  },
  previewPost: async (args: any, ctx: any) => {
    const html = await renderPostPortableTextToHtml(args.body.body)
    const headings = collectHeadings(args.body.body, deriveSlug)
    return { status: 200 as const, body: { html, headings } }
  },
  upsertPostMeta: async (args: any, ctx: any) => {
    const meta = {
      slug: args.body.slug,
      title: args.body.title,
      summary: args.body.summary,
      cover: args.body.cover,
      og: args.body.og,
      published: args.body.published,
      commentsEnabled: args.body.commentsEnabled,
      showToc: args.body.showToc,
      showUpdated: args.body.showUpdated,
      visible: args.body.visible,
      category: args.body.category,
      tags: args.body.tags,
      alias: args.body.alias,
      pinnedAt:
        args.body.pinnedAt === undefined || args.body.pinnedAt === null
          ? args.body.pinnedAt
          : new Date(args.body.pinnedAt),
      publishedAt: args.body.publishedAt === undefined ? undefined : new Date(args.body.publishedAt),
    }
    const sessionUserId = BigInt(ctx.viewer.userId)
    const post =
      args.body.id === undefined
        ? await createPost(meta, sessionUserId, ctx.viewer)
        : await updatePostMeta({ id: BigInt(args.body.id), ...meta }, ctx.viewer)
    return { status: 200 as const, body: { post } }
  },
  listPostRevisions: async (args: any, ctx: any) => {
    const revisions = await listPostRevisionsForAdmin(BigInt(args.query.id), ctx.viewer)
    return { status: 200 as const, body: { revisions } }
  },
}
