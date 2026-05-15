import type { adminImagesContract } from '@/shared/contracts/admin/images'

import { requireViewer, type ContractImpl, type HandlerContext } from '@/server/http/ts-rest-adapter'
import {
  deleteImage,
  listImagesForAdmin,
  recalculateImageThumbhash,
  updateImageNote,
  uploadImage,
} from '@/server/images/service'
import { userSession } from '@/server/session'
import { requireBlogSettingsSection } from '@/shared/blog-config'

export const adminImagesController: ContractImpl<typeof adminImagesContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = args.query as {
      q?: string
      kind?: 'generic' | 'category' | 'friend' | 'all'
      offset?: number
      limit?: number
    }
    const result = await listImagesForAdmin({
      q: q.q,
      kind: q.kind,
      offset: q.offset,
      limit: q.limit,
    })
    return { status: 200, body: result }
  },

  upload: async (_args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const settings = requireBlogSettingsSection('assets')

    let formData: FormData
    try {
      formData = await ctx.request.formData()
    } catch {
      return { status: 400, body: { error: { message: '无法解析 multipart 请求体' } } }
    }

    const fileEntry = formData.get('file')
    if (!(fileEntry instanceof Blob)) {
      return { status: 400, body: { error: { message: '缺少图片文件 (file 字段必填)' } } }
    }
    if (fileEntry.size > settings.upload.maxBytes) {
      return {
        status: 413,
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

    const kind = metadataObj.kind
    if (kind !== 'generic' && kind !== 'category' && kind !== 'friend') {
      return { status: 400, body: { error: { message: '无效的图片类型' } } }
    }

    const adminUser = userSession(ctx.session)
    if (!adminUser) {
      return { status: 401, body: { error: { message: '未登录' } } }
    }
    const buffer = Buffer.from(await fileEntry.arrayBuffer())
    const uploader = { id: BigInt(viewer.userId), name: adminUser.name }

    let image
    if (kind === 'generic') {
      image = await uploadImage({
        kind: { kind: 'generic' },
        buffer,
        note: metadataObj.note ?? null,
        uploader,
        maxBytes: settings.upload.maxBytes,
        jpegQuality: settings.upload.jpegQuality,
      })
    } else if (kind === 'category') {
      image = await uploadImage({
        kind: { kind: 'category', slug: metadataObj.slug ?? '' },
        buffer,
        note: metadataObj.note ?? null,
        uploader,
        maxBytes: settings.upload.maxBytes,
        jpegQuality: settings.upload.jpegQuality,
      })
    } else {
      image = await uploadImage({
        kind: { kind: 'friend', host: metadataObj.host ?? '' },
        buffer,
        note: metadataObj.note ?? null,
        uploader,
        maxBytes: settings.upload.maxBytes,
        jpegQuality: settings.upload.jpegQuality,
      })
    }

    return { status: 200, body: { image } }
  },

  delete: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const { id } = args.params as { id: string }
    await deleteImage(BigInt(id), viewer)
    return { status: 200, body: { success: true } }
  },

  updateNote: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const { id } = args.params as { id: string }
    const body = args.body as { note?: string | null }
    const image = await updateImageNote(BigInt(id), body.note ?? null, viewer)
    return { status: 200, body: { image } }
  },

  recalculateThumbhash: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const { id } = args.params as { id: string }
    const image = await recalculateImageThumbhash(BigInt(id), viewer)
    return { status: 200, body: { image } }
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
