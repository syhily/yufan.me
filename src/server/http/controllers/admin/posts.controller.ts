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
import { ok, notFound } from '@/server/http/response'
import {
  body,
  query,
  asId,
  requireViewer,
  resolveId,
  type ContractImpl,
  type HandlerContext,
} from '@/server/http/ts-rest-adapter'
import { deriveSlug } from '@/server/slug'
import { collectHeadings } from '@/shared/pt/schema'

interface PostsListQuery {
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

interface UpsertPostMetaBody {
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

interface PostDraftBody {
  body: PortableTextBody
  expectedClientRevisionToken?: string | null
  force?: boolean
  publishedAt?: string
}

interface PreviewBody {
  body: PortableTextBody
}

export const adminPostsController: ContractImpl<typeof adminPostsContract> = {
  list: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const q = query<PostsListQuery>(args)
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
    return ok(result)
  },

  get: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const detail = await getPostDetailForAdmin(asId(id), viewer)
    if (detail === null) {
      return notFound('文章不存在或已被删除。')
    }
    return ok(detail)
  },

  upsertMeta: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const b = body<UpsertPostMetaBody>(args)
    const meta = {
      slug: b.slug,
      title: b.title,
      summary: b.summary,
      cover: b.cover,
      og: b.og,
      published: b.published,
      commentsEnabled: b.commentsEnabled,
      showToc: b.showToc,
      showUpdated: b.showUpdated,
      visible: b.visible,
      category: b.category,
      tags: b.tags,
      alias: b.alias,
      pinnedAt: b.pinnedAt === undefined || b.pinnedAt === null ? b.pinnedAt : new Date(b.pinnedAt),
      publishedAt: b.publishedAt === undefined ? undefined : new Date(b.publishedAt),
    }
    const sessionUserId = asId(viewer.userId)
    const post =
      b.id === undefined
        ? await createPost(meta, sessionUserId, viewer)
        : await updatePostMeta({ id: asId(b.id), ...meta }, viewer)
    return ok({ post })
  },

  delete: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const result = await deletePost(asId(id), viewer)
    if (!result.deleted) {
      return notFound('文章不存在或已被删除。')
    }
    return ok({ success: true })
  },

  restore: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const result = await restorePost(asId(id), viewer)
    if (!result.restored) {
      return notFound('文章不存在或未被删除。')
    }
    return ok({ success: true })
  },

  listRevisions: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const revisions = await listRevisionsForAdmin(asId(id), viewer)
    return ok({ revisions })
  },

  saveDraft: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const b = body<PostDraftBody>(args)
    const result = await saveDraft(
      {
        postId: asId(id),
        body: b.body,
        expectedClientRevisionToken: b.expectedClientRevisionToken ?? undefined,
        force: b.force,
        authorId: asId(viewer.userId),
      },
      viewer,
    )
    return ok(result)
  },

  publish: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const b = body<PostDraftBody>(args)
    const result = await publishLatest(
      {
        postId: asId(id),
        body: b.body,
        expectedClientRevisionToken: b.expectedClientRevisionToken ?? undefined,
        force: b.force,
        authorId: asId(viewer.userId),
        publishedAt: b.publishedAt !== undefined ? new Date(b.publishedAt) : undefined,
      },
      viewer,
    )
    return ok(result)
  },

  unpublish: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const post = await unpublishPost(asId(id), viewer)
    return ok({ post })
  },

  preview: async (_args: Record<string, unknown>, _ctx: HandlerContext) => {
    const b = body<PreviewBody>(_args)
    const html = await renderPortableTextToHtml(b.body)
    const headings = collectHeadings(b.body, deriveSlug)
    return ok({ html, headings })
  },
}
