import type { ActionFunctionArgs } from 'react-router'

import { uploadImageMetadataSchema } from '@/server/images/schema'
import { uploadImage } from '@/server/images/service'
import {
  ActionFailure,
  assertMethod,
  parseInput,
  requireAdminSession,
  runApi,
} from '@/server/route-helpers/api-handler'
import { userSession } from '@/server/session'
import { requireBlogSettingsSection } from '@/shared/blog-config'

// Single multipart endpoint for the entire image library. Bypasses
// `defineApiAction` because the helper drops file entries on the
// floor — uploads need both the metadata fields and the JPEG blob.

export async function action(args: ActionFunctionArgs) {
  return runApi(args, async ({ request, session }) => {
    assertMethod(request, 'POST')
    requireAdminSession(session)
    const adminUser = userSession(session)
    if (adminUser === undefined) {
      throw new ActionFailure(403, '需要管理员登录')
    }

    const settings = requireBlogSettingsSection('assets')

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      throw new ActionFailure(400, '无法解析 multipart 请求体')
    }

    const fileEntry = formData.get('file')
    if (!(fileEntry instanceof Blob)) {
      throw new ActionFailure(400, '缺少图片文件 (file 字段必填)', [{ message: 'file 字段必填', path: ['file'] }])
    }
    if (fileEntry.size > settings.upload.maxBytes) {
      throw new ActionFailure(413, `图片体积超过上限（${formatBytes(settings.upload.maxBytes)}）`)
    }

    // Build the metadata object from string-only entries so the schema
    // sees the same shape `defineApiAction` would have prepared.
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

    const uploader = { id: BigInt(adminUser.id), name: adminUser.name }

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

    // Re-uploads to a state-keyed slot (category cover / friend
    // poster) overwrite the same S3 object, so the URL stored on the
    // referencing rows doesn't change — but `image.updatedAt` does.
    // Reset the catalog so the next render rebuilds with the fresh
    // `?v=` cache buster derived from the new `updatedAt`. Generic
    // re-uploads land at a fresh key and don't strictly need this,
    // but keeping the reset unconditional is the simpler contract.

    return { image }
  })
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
