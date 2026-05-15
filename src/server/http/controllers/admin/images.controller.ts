import type { adminImagesContract } from '@/shared/contracts/admin/images'

import { ok, badRequest, unauthorized } from '@/server/http/response'
import {
  body,
  query,
  asId,
  requireViewer,
  resolveId,
  type ContractImpl,
  type HandlerContext,
} from '@/server/http/ts-rest-adapter'
import {
  deleteImage,
  listImagesForAdmin,
  recalculateImageThumbhash,
  updateImageNote,
  uploadImage,
} from '@/server/images/service'
import { userSession } from '@/server/session'
import { requireBlogSettingsSection } from '@/shared/blog-config'

interface ImagesListQuery {
  q?: string
  kind?: 'generic' | 'category' | 'friend' | 'all'
  offset?: number
  limit?: number
}

interface UpdateNoteBody {
  note?: string | null
}

export const adminImagesController: ContractImpl<typeof adminImagesContract> = {
  list: async (args: Record<string, unknown>, _ctx: HandlerContext) => {
    const q = query<ImagesListQuery>(args)
    const result = await listImagesForAdmin({
      q: q.q,
      kind: q.kind,
      offset: q.offset,
      limit: q.limit,
    })
    return ok(result)
  },

  upload: async (_args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const settings = requireBlogSettingsSection('assets')

    let formData: FormData
    try {
      formData = await ctx.request.formData()
    } catch {
      return badRequest('无法解析 multipart 请求体')
    }

    const fileEntry = formData.get('file')
    if (!(fileEntry instanceof Blob)) {
      return badRequest('缺少图片文件 (file 字段必填)')
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
      return badRequest('无效的图片类型')
    }

    const adminUser = userSession(ctx.session)
    if (!adminUser) {
      return unauthorized()
    }
    const buffer = Buffer.from(await fileEntry.arrayBuffer())
    const uploader = { id: asId(viewer.userId), name: adminUser.name }

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

    return ok({ image })
  },

  delete: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    await deleteImage(asId(id), viewer)
    return ok({ success: true })
  },

  updateNote: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const b = body<UpdateNoteBody>(args)
    const image = await updateImageNote(asId(id), b.note ?? null, viewer)
    return ok({ image })
  },

  recalculateThumbhash: async (args: Record<string, unknown>, ctx: HandlerContext) => {
    const viewer = requireViewer(ctx)
    const id = resolveId(args)
    const image = await recalculateImageThumbhash(asId(id), viewer)
    return ok({ image })
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
