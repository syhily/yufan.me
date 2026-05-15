import type { adminPostsContract } from '@/shared/contracts/admin/posts'
import type { PortableTextBody } from '@/shared/pt/schema'

import { renderPortableTextToHtml } from '@/server/cms/posts/preview'
import {
  createPost,
  deletePost,
  getPostDetailForAdmin,
  listPostsForAdmin,
  listRevisionsForAdmin,
  publishLatest,
  restorePost,
  saveDraft,
  unpublishPost,
  updatePostMeta,
} from '@/server/cms/posts/service'
import { requireViewer, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { deriveSlug } from '@/server/slug'
import { collectHeadings } from '@/shared/pt/schema'

export const adminPostsController: ContractImpl<typeof adminPostsContract> = {
  list: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const q = args.query as {
      q?: string
      deletedStatus?: 'all' | 'deleted' | 'normal'
      offset?: number
      limit?: number
      category?: string
      tag?: string
      published?: boolean
      visible?: boolean
      sortBy?: 'publishedAt' | 'updatedAt'
      sortOrder?: 'asc' | 'desc'
      authorId?: bigint
    }
    const result = await listPostsForAdmin(
      {
        q: q.q,
        deletedStatus: q.deletedStatus,
        offset: q.offset,
        limit: q.limit,
        category: q.category,
        tag: q.tag,
        published: q.published,
        visible: q.visible,
        sortBy: q.sortBy,
        sortOrder: q.sortOrder,
        authorId: q.authorId,
      },
      viewer,
    )
    return { status: 200, body: result }
  },

  get: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const { id } = args.params as { id: string }
    const detail = await getPostDetailForAdmin(BigInt(id), viewer)
    if (detail === null) {
      return { status: 404, body: { error: { message: '文章不存在或已被删除。' } } }
    }
    return { status: 200, body: detail }
  },

  upsertMeta: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const body = args.body as {
      id?: string
      slug?: string
      title: string
      summary?: string
      cover?: string
      og?: string | null
      published?: boolean
      commentsEnabled?: boolean
      showToc?: boolean
      showUpdated?: boolean
      visible?: boolean
      pinnedAt?: string | null
      publishedAt?: string
      category?: string
      tags?: string[]
      alias?: string[]
    }
    const meta = {
      slug: body.slug,
      title: body.title,
      summary: body.summary,
      cover: body.cover,
      og: body.og,
      published: body.published,
      commentsEnabled: body.commentsEnabled,
      showToc: body.showToc,
      showUpdated: body.showUpdated,
      visible: body.visible,
      category: body.category,
      tags: body.tags,
      alias: body.alias,
      pinnedAt: body.pinnedAt === undefined || body.pinnedAt === null ? body.pinnedAt : new Date(body.pinnedAt),
      publishedAt: body.publishedAt === undefined ? undefined : new Date(body.publishedAt),
    }
    const sessionUserId = BigInt(viewer.userId)
    const post =
      body.id === undefined
        ? await createPost(meta, sessionUserId, viewer)
        : await updatePostMeta({ id: BigInt(body.id), ...meta }, viewer)
    return { status: 200, body: { post } }
  },

  delete: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const { id } = args.params as { id: string }
    const result = await deletePost(BigInt(id), viewer)
    if (!result.deleted) {
      return { status: 404, body: { error: { message: '文章不存在或已被删除。' } } }
    }
    return { status: 200, body: { success: true } }
  },

  restore: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const { id } = args.params as { id: string }
    const result = await restorePost(BigInt(id), viewer)
    if (!result.restored) {
      return { status: 404, body: { error: { message: '文章不存在或未被删除。' } } }
    }
    return { status: 200, body: { success: true } }
  },

  listRevisions: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const { id } = args.params as { id: string }
    const revisions = await listRevisionsForAdmin(BigInt(id), viewer)
    return { status: 200, body: { revisions } }
  },

  saveDraft: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const { id } = args.params as { id: string }
    const body = args.body as {
      body: PortableTextBody
      expectedClientRevisionToken?: string | null
      force?: boolean
      publishedAt?: string
    }
    const result = await saveDraft(
      {
        postId: BigInt(id),
        body: body.body,
        expectedClientRevisionToken: body.expectedClientRevisionToken ?? undefined,
        force: body.force,
        authorId: BigInt(viewer.userId),
      },
      viewer,
    )
    return { status: 200, body: result }
  },

  publish: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const { id } = args.params as { id: string }
    const body = args.body as {
      body: PortableTextBody
      expectedClientRevisionToken?: string | null
      force?: boolean
      publishedAt?: string
    }
    const result = await publishLatest(
      {
        postId: BigInt(id),
        body: body.body,
        expectedClientRevisionToken: body.expectedClientRevisionToken ?? undefined,
        force: body.force,
        authorId: BigInt(viewer.userId),
        publishedAt: body.publishedAt !== undefined ? new Date(body.publishedAt) : undefined,
      },
      viewer,
    )
    return { status: 200, body: result }
  },

  unpublish: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const { id } = args.params as { id: string }
    const post = await unpublishPost(BigInt(id), viewer)
    return { status: 200, body: { post } }
  },

  preview: async (_args: Record<string, unknown>, _ctx: HandlerContext) => {
    const body = _args.body as { body: PortableTextBody }
    const html = await renderPortableTextToHtml(body.body)
    const headings = collectHeadings(body.body, deriveSlug)
    return { status: 200, body: { html, headings } }
  },
}
