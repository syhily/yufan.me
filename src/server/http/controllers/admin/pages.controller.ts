import type { adminPagesContract } from '@/shared/contracts/admin/pages'

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

import type { ContentDraftBody, ContentListQuery, ContentPreviewBody } from './content'

interface UpsertPageMetaBody {
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

export const adminPagesController: ContractImpl<typeof adminPagesContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<ContentListQuery>(args)
    const result = await listPagesForAdmin({
      q: q.q,
      deletedStatus: q.deletedStatus,
      offset: q.offset,
      limit: q.limit,
    })
    return ok(result)
  },

  get: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const detail = await getPageDetailForAdmin(asId(id))
    if (detail === null) {
      return notFound('页面不存在或已被删除。')
    }
    return ok(detail)
  },

  upsertMeta: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const b = body<UpsertPageMetaBody>(args)
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
      showFriends: b.showFriends,
      publishedAt: b.publishedAt === undefined ? undefined : new Date(b.publishedAt),
    }
    const sessionUserId = asId(viewer.userId)
    const page =
      b.id === undefined ? await createPage(meta, sessionUserId) : await updatePageMeta({ id: asId(b.id), ...meta })
    return ok({ page })
  },

  delete: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const result = await deletePage(asId(id))
    if (!result.deleted) {
      return notFound('页面不存在或已被删除。')
    }
    return ok({ success: true })
  },

  restore: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const result = await restorePage(asId(id))
    if (!result.restored) {
      return notFound('页面不存在或未被删除。')
    }
    return ok({ success: true })
  },

  listRevisions: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const revisions = await listRevisionsForAdmin(asId(id))
    return ok({ revisions })
  },

  saveDraft: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const b = body<ContentDraftBody>(args)
    const result = await saveDraft({
      pageId: asId(id),
      body: b.body,
      expectedClientRevisionToken: b.expectedClientRevisionToken ?? undefined,
      force: b.force,
      authorId: asId(viewer.userId),
    })
    return ok(result)
  },

  publish: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const b = body<ContentDraftBody>(args)
    const result = await publishLatest({
      pageId: asId(id),
      body: b.body,
      expectedClientRevisionToken: b.expectedClientRevisionToken ?? undefined,
      force: b.force,
      authorId: asId(viewer.userId),
      publishedAt: b.publishedAt !== undefined ? new Date(b.publishedAt) : undefined,
    })
    return ok(result)
  },

  unpublish: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const id = resolveId(args)
    const page = await unpublishPage(asId(id))
    return ok({ page })
  },

  preview: async (_args: Record<string, unknown>, _ctx: HandlerContext) => {
    const b = body<ContentPreviewBody>(_args)
    const html = await renderPortableTextToHtml(b.body)
    const headings = collectHeadings(b.body, deriveSlug)
    return ok({ html, headings })
  },
}
