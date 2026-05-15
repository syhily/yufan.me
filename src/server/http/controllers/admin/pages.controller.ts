import type { adminPagesContract } from '@/shared/contracts/admin/pages'
import type { PortableTextBody } from '@/shared/pt/schema'

import { renderPortableTextToHtml } from '@/server/cms/pages/preview'
import {
  createPage,
  deletePage,
  getPageDetailForAdmin,
  listPagesForAdmin,
  listRevisionsForAdmin,
  publishLatest,
  restorePage,
  saveDraft,
  unpublishPage,
  updatePageMeta,
} from '@/server/cms/pages/service'
import { requireViewer, resolveId, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import { deriveSlug } from '@/server/slug'
import { collectHeadings } from '@/shared/pt/schema'

export const adminPagesController: ContractImpl<typeof adminPagesContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = args.query as {
      q?: string
      deletedStatus?: 'all' | 'deleted' | 'normal'
      offset?: number
      limit?: number
    }
    const result = await listPagesForAdmin({
      q: q.q,
      deletedStatus: q.deletedStatus,
      offset: q.offset,
      limit: q.limit,
    })
    return { status: 200, body: result }
  },

  get: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const detail = await getPageDetailForAdmin(BigInt(id))
    if (detail === null) {
      return { status: 404, body: { error: { message: '页面不存在或已被删除。' } } }
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
      showFriends?: boolean
      publishedAt?: string
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
      showFriends: body.showFriends,
      publishedAt: body.publishedAt === undefined ? undefined : new Date(body.publishedAt),
    }
    const sessionUserId = BigInt(viewer.userId)
    const page =
      body.id === undefined
        ? await createPage(meta, sessionUserId)
        : await updatePageMeta({ id: BigInt(body.id), ...meta })
    return { status: 200, body: { page } }
  },

  delete: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const result = await deletePage(BigInt(id))
    if (!result.deleted) {
      return { status: 404, body: { error: { message: '页面不存在或已被删除。' } } }
    }
    return { status: 200, body: { success: true } }
  },

  restore: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const result = await restorePage(BigInt(id))
    if (!result.restored) {
      return { status: 404, body: { error: { message: '页面不存在或未被删除。' } } }
    }
    return { status: 200, body: { success: true } }
  },

  listRevisions: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const revisions = await listRevisionsForAdmin(BigInt(id))
    return { status: 200, body: { revisions } }
  },

  saveDraft: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const body = args.body as {
      body: PortableTextBody
      expectedClientRevisionToken?: string | null
      force?: boolean
      publishedAt?: string
    }
    const result = await saveDraft({
      pageId: BigInt(id),
      body: body.body,
      expectedClientRevisionToken: body.expectedClientRevisionToken ?? undefined,
      force: body.force,
      authorId: BigInt(viewer.userId),
    })
    return { status: 200, body: result }
  },

  publish: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const body = args.body as {
      body: PortableTextBody
      expectedClientRevisionToken?: string | null
      force?: boolean
      publishedAt?: string
    }
    const result = await publishLatest({
      pageId: BigInt(id),
      body: body.body,
      expectedClientRevisionToken: body.expectedClientRevisionToken ?? undefined,
      force: body.force,
      authorId: BigInt(viewer.userId),
      publishedAt: body.publishedAt !== undefined ? new Date(body.publishedAt) : undefined,
    })
    return { status: 200, body: result }
  },

  unpublish: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const page = await unpublishPage(BigInt(id))
    return { status: 200, body: { page } }
  },

  preview: async (_args: Record<string, unknown>, _ctx: HandlerContext) => {
    const body = _args.body as { body: PortableTextBody }
    const html = await renderPortableTextToHtml(body.body)
    const headings = collectHeadings(body.body, deriveSlug)
    return { status: 200, body: { html, headings } }
  },
}
