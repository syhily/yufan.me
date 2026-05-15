import type { AuthedContractImpl } from '@/server/http/ts-rest-adapter'
import type { AdminImageKind } from '@/shared/images'

import { uploadImageMetadataSchema } from '@/server/images/schema'
import {
  deleteImage,
  listImagesForAdmin,
  recalculateImageThumbhash,
  updateImageNote,
  uploadImage,
} from '@/server/images/service'
import { parseInput } from '@/server/route-helpers/errors'
import { userSession } from '@/server/session'
import { requireBlogSettingsSection } from '@/shared/blog-config'
import { adminImagesContract } from '@/shared/contracts/admin/images'

export const adminImagesController: AuthedContractImpl<typeof adminImagesContract> = {
  listImages: async (args, _ctx) => {
    const result = await listImagesForAdmin({
      q: args.query.q,
      kind: args.query.kind as AdminImageKind | 'all' | undefined,
      offset: args.query.offset,
      limit: args.query.limit,
    })
    return { status: 200 as const, body: result }
  },
  deleteImage: async (args, ctx) => {
    await deleteImage(BigInt(args.params.id), ctx.viewer ?? undefined)
    return { status: 200 as const, body: { success: true } }
  },
  updateImageNote: async (args, ctx) => {
    const image = await updateImageNote(BigInt(args.params.id), args.body.note ?? null, ctx.viewer ?? undefined)
    return { status: 200 as const, body: { image } }
  },
  recalculateImageThumbhash: async (args, ctx) => {
    const image = await recalculateImageThumbhash(BigInt(args.body.id), ctx.viewer ?? undefined)
    return { status: 200 as const, body: { image } }
  },
  uploadImage: async (args, ctx) => {
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
      if (key === 'file') {
        continue
      }
      if (typeof value === 'string') {
        metadataObj[key] = value
      }
    }

    const metadata = await parseInput(uploadImageMetadataSchema, metadataObj)

    const buffer = Buffer.from(await fileEntry.arrayBuffer())
    const sessionUser = userSession(ctx.session)
    if (!sessionUser) {
      return { status: 401 as const, body: { error: { message: '未登录' } } }
    }
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
