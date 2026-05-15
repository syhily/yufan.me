import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'

import { renderPortableTextToHtml as renderPagePortableTextToHtml } from '@/server/cms/pages/preview'
import {
  createPage,
  deletePage,
  getPageDetailForAdmin,
  listPagesForAdmin,
  listRevisionsForAdmin as listPageRevisionsForAdmin,
  publishLatest as publishPageLatest,
  restorePage,
  saveDraft as savePageDraft,
  unpublishPage,
  updatePageMeta,
} from '@/server/cms/pages/service'
import { deriveSlug } from '@/server/slug'
import { adminPagesContract } from '@/shared/contracts/admin/pages'
import { collectHeadings } from '@/shared/pt/schema'

export const adminPagesController: AuthedContractImpl<typeof adminPagesContract> = {
  // TODO: add `satisfies AuthedContractImpl<typeof adminPagesContract>` once all response schemas are strict
  list: async (args, _ctx) => {
    const result = await listPagesForAdmin({
      q: args.query.q,
      deletedStatus: args.query.deletedStatus,
      offset: args.query.offset,
      limit: args.query.limit,
    })
    return { status: 200 as const, body: result }
  },
  get: async (args, _ctx) => {
    const detail = await getPageDetailForAdmin(BigInt(args.params.id))
    if (detail === null) {
      return { status: 404 as const, body: { error: { message: '页面不存在或已被删除。' } } }
    }
    return { status: 200 as const, body: detail }
  },
  delete: async (args, _ctx) => {
    const result = await deletePage(BigInt(args.params.id))
    if (!result.deleted) {
      return { status: 404 as const, body: { error: { message: '页面不存在或已被删除。' } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
  restore: async ({ params }, _ctx) => {
    const result = await restorePage(BigInt(params.id))
    if (!result.restored) {
      return { status: 404 as const, body: { error: { message: '页面不存在或未被删除。' } } }
    }
    return { status: 200 as const, body: { success: true } }
  },
  unpublish: async (args, _ctx) => {
    const page = await unpublishPage(BigInt(args.body.id))
    return { status: 200 as const, body: { page } }
  },
  saveDraft: async (args, { viewer }) => {
    const result = await savePageDraft({
      pageId: BigInt(args.body.id),
      body: args.body.body,
      expectedClientRevisionToken: args.body.expectedClientRevisionToken ?? undefined,
      force: args.body.force,
      authorId: BigInt(viewer!.userId),
    })
    return { status: 200 as const, body: result }
  },
  publishLatest: async (args, { viewer }) => {
    const result = await publishPageLatest({
      pageId: BigInt(args.body.id),
      body: args.body.body,
      expectedClientRevisionToken: args.body.expectedClientRevisionToken ?? undefined,
      force: args.body.force,
      authorId: BigInt(viewer!.userId),
      publishedAt: args.body.publishedAt !== undefined ? new Date(args.body.publishedAt) : undefined,
    })
    return { status: 200 as const, body: result }
  },
  preview: async (args, _ctx) => {
    const html = await renderPagePortableTextToHtml(args.body.body)
    const headings = collectHeadings(args.body.body, deriveSlug)
    return { status: 200 as const, body: { html, headings } }
  },
  upsertMeta: async (args, { viewer }) => {
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
      showFriends: args.body.showFriends,
      publishedAt: args.body.publishedAt === undefined ? undefined : new Date(args.body.publishedAt),
    }
    const sessionUserId = BigInt(viewer!.userId)
    const page =
      args.body.id === undefined
        ? await createPage(meta, sessionUserId)
        : await updatePageMeta({ id: BigInt(args.body.id), ...meta })
    return { status: 200 as const, body: { page } }
  },
  listRevisions: async (args, _ctx) => {
    const revisions = await listPageRevisionsForAdmin(BigInt(args.query.id))
    return { status: 200 as const, body: { revisions } }
  },
}
