import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'

import { renderPortableTextToHtml as renderPostPortableTextToHtml } from '@/server/cms/posts/preview'
import {
  createPost,
  deletePost,
  getPostDetailForAdmin,
  listPostsForAdmin,
  listRevisionsForAdmin as listPostRevisionsForAdmin,
  publishLatest as publishPostLatest,
  restorePost,
  saveDraft as savePostDraft,
  unpublishPost,
  updatePostMeta,
} from '@/server/cms/posts/service'
import { deriveSlug } from '@/server/slug'
import { adminPostsContract } from '@/shared/contracts/admin/posts'
import { collectHeadings } from '@/shared/pt/schema'

export const adminPostsController: AuthedContractImpl<typeof adminPostsContract> = {
  // TODO: add `satisfies AuthedContractImpl<typeof adminPostsContract>` once all response schemas are strict
  list: async (args, ctx) => {
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
      ctx.viewer ?? undefined,
    )
    return { status: 200 as const, body: result }
  },
  get: async (args, ctx) => {
    const detail = await getPostDetailForAdmin(BigInt(args.params.id), ctx.viewer ?? undefined)
    if (detail === null) {
      return { status: 404 as const, body: { error: { message: '文章不存在或已被删除。' } } }
    }
    return { status: 200 as const, body: detail }
  },
  delete: async (args, ctx) => {
    const result = await deletePost(BigInt(args.params.id), ctx.viewer ?? undefined)
    if (!result.deleted) {
      return { status: 404 as const, body: { error: { message: '文章不存在或已被删除。' } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
  restore: async (args, ctx) => {
    const result = await restorePost(BigInt(args.params.id), ctx.viewer ?? undefined)
    if (!result.restored) {
      return { status: 404 as const, body: { error: { message: '文章不存在或未被删除。' } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
  unpublish: async (args, ctx) => {
    const post = await unpublishPost(BigInt(args.body.id), ctx.viewer ?? undefined)
    return { status: 200 as const, body: { post } }
  },
  saveDraft: async (args, ctx) => {
    const result = await savePostDraft(
      {
        postId: BigInt(args.body.id),
        body: args.body.body,
        expectedClientRevisionToken: args.body.expectedClientRevisionToken ?? undefined,
        force: args.body.force,
        authorId: BigInt(ctx.viewer!.userId),
      },
      ctx.viewer ?? undefined,
    )
    return { status: 200 as const, body: result }
  },
  publishLatest: async (args, ctx) => {
    const result = await publishPostLatest(
      {
        postId: BigInt(args.body.id),
        body: args.body.body,
        expectedClientRevisionToken: args.body.expectedClientRevisionToken ?? undefined,
        force: args.body.force,
        authorId: BigInt(ctx.viewer!.userId),
        publishedAt: args.body.publishedAt !== undefined ? new Date(args.body.publishedAt) : undefined,
      },
      ctx.viewer ?? undefined,
    )
    return { status: 200 as const, body: result }
  },
  preview: async (args, _ctx) => {
    const html = await renderPostPortableTextToHtml(args.body.body)
    const headings = collectHeadings(args.body.body, deriveSlug)
    return { status: 200 as const, body: { html, headings } }
  },
  upsertMeta: async (args, ctx) => {
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
    const sessionUserId = BigInt(ctx.viewer!.userId)
    const post =
      args.body.id === undefined
        ? await createPost(meta, sessionUserId, ctx.viewer ?? undefined)
        : await updatePostMeta({ id: BigInt(args.body.id), ...meta }, ctx.viewer ?? undefined)
    return { status: 200 as const, body: { post } }
  },
  listRevisions: async (args, ctx) => {
    const revisions = await listPostRevisionsForAdmin(BigInt(args.query.id), ctx.viewer ?? undefined)
    return { status: 200 as const, body: { revisions } }
  },
}
