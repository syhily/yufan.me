import { ORPCError } from '@orpc/server'
import { z } from 'zod'

import { renderPortableTextToHtml as renderPostPortableTextToHtml } from '@/server/cms/posts/preview'
import {
  listPostsSchema,
  previewPostBodySchema,
  savePostBodySchema,
  upsertPostMetaSchema,
} from '@/server/cms/posts/schema'
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
import { authorProc } from '@/server/http/orpc-base'
import { deriveSlug } from '@/server/slug'
import {
  adminPostDetailDto,
  adminPostDto,
  adminRevisionDto,
  listPostRevisionsOutputDto,
  listPostsOutputDto,
} from '@/shared/contracts/_dtos'
import { collectHeadings } from '@/shared/pt/schema'

const idInput = z.object({ id: z.string().min(1) })

const saveResultOutput = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), revision: adminRevisionDto }),
  z.object({ status: z.literal('conflict'), latest: adminRevisionDto, expectedToken: z.string() }),
])

const list = authorProc
  .input(listPostsSchema)
  .output(listPostsOutputDto)
  .handler(({ input, context }) => listPostsForAdmin(input, context.viewer))

const get = authorProc
  .input(idInput)
  .output(adminPostDetailDto)
  .handler(async ({ input, context }) => {
    const detail = await getPostDetailForAdmin(BigInt(input.id), context.viewer)
    if (detail === null) {
      throw new ORPCError('NOT_FOUND', { message: '文章不存在或已被删除。' })
    }
    return detail
  })

const remove = authorProc
  .input(idInput)
  .output(z.void())
  .handler(async ({ input, context }) => {
    const result = await deletePost(BigInt(input.id), context.viewer)
    if (!result.deleted) {
      throw new ORPCError('NOT_FOUND', { message: '文章不存在或已被删除。' })
    }
  })

const restore = authorProc
  .input(idInput)
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context }) => {
    const result = await restorePost(BigInt(input.id), context.viewer)
    if (!result.restored) {
      throw new ORPCError('NOT_FOUND', { message: '文章不存在或未被删除。' })
    }
    return { success: true }
  })

const unpublish = authorProc
  .input(z.object({ id: z.string().min(1) }))
  .output(z.object({ post: adminPostDto }))
  .handler(async ({ input, context }) => {
    const post = await unpublishPost(BigInt(input.id), context.viewer)
    return { post }
  })

const saveDraft = authorProc
  .input(savePostBodySchema)
  .output(saveResultOutput)
  .handler(async ({ input, context }) => {
    return savePostDraft(
      {
        postId: BigInt(input.id),
        body: input.body,
        expectedClientRevisionToken: input.expectedClientRevisionToken ?? undefined,
        force: input.force,
        authorId: BigInt(context.viewer.userId),
      },
      context.viewer,
    )
  })

const publishLatest = authorProc
  .input(savePostBodySchema)
  .output(saveResultOutput)
  .handler(async ({ input, context }) => {
    return publishPostLatest(
      {
        postId: BigInt(input.id),
        body: input.body,
        expectedClientRevisionToken: input.expectedClientRevisionToken ?? undefined,
        force: input.force,
        authorId: BigInt(context.viewer.userId),
        publishedAt: input.publishedAt !== undefined ? new Date(input.publishedAt) : undefined,
      },
      context.viewer,
    )
  })

const preview = authorProc
  .input(previewPostBodySchema)
  .output(
    z.object({
      html: z.string(),
      headings: z.array(z.object({ text: z.string(), depth: z.coerce.number(), slug: z.string() })),
    }),
  )
  .handler(async ({ input }) => {
    const html = await renderPostPortableTextToHtml(input.body)
    const headings = collectHeadings(input.body, deriveSlug)
    return { html, headings }
  })

const upsertMeta = authorProc
  .input(upsertPostMetaSchema)
  .output(z.object({ post: adminPostDto }))
  .handler(async ({ input, context }) => {
    const meta = {
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      cover: input.cover,
      og: input.og,
      published: input.published,
      commentsEnabled: input.commentsEnabled,
      showToc: input.showToc,
      showUpdated: input.showUpdated,
      visible: input.visible,
      category: input.category,
      tags: input.tags,
      alias: input.alias,
      pinnedAt: input.pinnedAt === undefined || input.pinnedAt === null ? input.pinnedAt : new Date(input.pinnedAt),
      publishedAt: input.publishedAt === undefined ? undefined : new Date(input.publishedAt),
    }
    const sessionUserId = BigInt(context.viewer.userId)
    const post =
      input.id === undefined
        ? await createPost(meta, sessionUserId, context.viewer)
        : await updatePostMeta({ id: BigInt(input.id), ...meta }, context.viewer)
    return { post }
  })

const listRevisions = authorProc
  .input(z.object({ id: z.string().min(1) }))
  .output(listPostRevisionsOutputDto)
  .handler(async ({ input, context }) => {
    const revisions = await listPostRevisionsForAdmin(BigInt(input.id), context.viewer)
    return { revisions }
  })

export const adminPostsRouter = {
  list,
  get,
  delete: remove,
  restore,
  unpublish,
  saveDraft,
  publishLatest,
  preview,
  upsertMeta,
  listRevisions,
}
