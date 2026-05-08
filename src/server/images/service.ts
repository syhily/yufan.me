import type { ImageRow } from '@/server/db/types'
import type { AdminImageDto, ListImagesInput, ListImagesOutput } from '@/shared/images'

import { canEditImage, type ViewerContext } from '@/server/auth/rbac'
import {
  type AdminImagesListFilters,
  countAdminImages,
  findAdminImageRowById,
  findImageById,
  findImagesByStoragePaths,
  insertImage,
  listAdminImageRows,
  softDeleteImage,
  updateImageNoteWithUploader,
  updateImageThumbhashWithUploader,
  upsertImageByStoragePath,
} from '@/server/db/query/image'
import { type ImageKindSpec, buildObjectKey } from '@/server/images/key'
import { processImageBuffer } from '@/server/images/process'
import { buildPublicUrl, invalidateImageEnhanceCacheFor } from '@/server/images/render-enhance'
import { deleteImage as deleteStoredImage, getImage, putImage } from '@/server/images/storage'
import { getLogger } from '@/server/logger'
import { ActionFailure } from '@/server/route-helpers/api-handler'
import { ErrorMessages } from '@/server/route-helpers/errors'
import { classifyImageKind } from '@/shared/images'

// Domain-level entry points for the admin image library. Coordinates
// the four side effects an upload triggers (process → S3 PUT → DB
// upsert → cache invalidation) so the resource-route action stays a
// thin perimeter, and exposes the read paths the SSR enhancer needs.

const log = getLogger('images.service')

export type UploadKind = { kind: 'generic' } | { kind: 'category'; slug: string } | { kind: 'friend'; host: string }

export interface UploadImageInputs {
  kind: UploadKind
  buffer: Buffer
  note?: string | null
  /**
   * The currently authenticated admin. `name` is propagated straight
   * into the response DTO so the admin table can render the uploader
   * column without a round-trip; `null` only ever happens for the
   * upload path that runs outside an admin session (none today, but
   * kept for symmetry with the legacy signature).
   */
  uploader: { id: bigint; name: string } | null
  /**
   * Hard cap forwarded from `assetsSchema.upload.maxBytes`. The route
   * already validates the request body length, but we double-check
   * here against the post-process buffer in case the editor ships
   * something pathological.
   */
  maxBytes: number
  /** Quality forwarded from `assetsSchema.upload.jpegQuality`. */
  jpegQuality: number
}

export async function uploadImage(input: UploadImageInputs): Promise<AdminImageDto> {
  if (input.buffer.byteLength > input.maxBytes) {
    throw new ActionFailure(413, `图片体积超过上限（${formatBytes(input.maxBytes)}）`)
  }

  const processed = await processImageBuffer({
    buffer: input.buffer,
    jpegQuality: input.jpegQuality,
  })

  if (processed.buffer.byteLength > input.maxBytes) {
    throw new ActionFailure(413, `重编码后体积超过上限（${formatBytes(input.maxBytes)}）`)
  }

  const keySpec = toKeySpec(input.kind)
  const objectKey = buildObjectKey(keySpec)

  await putImage({
    storagePath: objectKey,
    body: processed.buffer,
    contentType: 'image/jpeg',
  })

  const trimmedNote = input.note?.trim() ?? ''
  const noteValue = trimmedNote === '' ? null : trimmedNote

  let row: ImageRow
  if (input.kind.kind === 'generic') {
    // Timestamp keys are practically unique; the unique index would
    // catch any accidental collision and the catch loudly surfaces it.
    try {
      row = await insertImage({
        storagePath: objectKey,
        mimeType: 'image/jpeg',
        width: processed.width,
        height: processed.height,
        byteSize: processed.byteSize,
        thumbhash: processed.thumbhash,
        uploaderId: input.uploader?.id ?? null,
        note: noteValue,
      })
    } catch (error) {
      log.error('Generic image insert failed (storage_path collision?)', { objectKey, error })
      throw new ActionFailure(500, '图片元数据写入失败，请稍后重试')
    }
  } else {
    row = await upsertImageByStoragePath({
      storagePath: objectKey,
      mimeType: 'image/jpeg',
      width: processed.width,
      height: processed.height,
      byteSize: processed.byteSize,
      thumbhash: processed.thumbhash,
      uploaderId: input.uploader?.id ?? null,
      note: noteValue,
    })
  }

  await invalidateImageEnhanceCacheFor(row.storagePath)

  return toAdminImageDto(row, input.uploader?.name ?? null)
}

export async function listImagesForAdmin(input: ListImagesInput = {}): Promise<ListImagesOutput> {
  const offset = clampOffset(input.offset)
  const limit = clampLimit(input.limit)

  const filters: AdminImagesListFilters = {
    q: input.q,
    kind: input.kind,
    offset,
    limit,
  }

  const [rows, total] = await Promise.all([
    listAdminImageRows(filters),
    countAdminImages({ q: input.q, kind: input.kind }),
  ])

  return {
    images: rows.map((row) => toAdminImageDto(row, row.uploaderName)),
    total,
    hasMore: offset + rows.length < total,
  }
}

export type ImageViewerContext = ViewerContext

export async function deleteImage(id: bigint, viewer?: ImageViewerContext): Promise<void> {
  const existing = await findImageById(id)
  if (existing === null) {
    throw new ActionFailure(404, '图片不存在')
  }
  if (viewer && !canEditImage(viewer, existing)) {
    throw new ActionFailure(404, ErrorMessages.NOT_FOUND)
  }

  try {
    await deleteStoredImage(existing.storagePath)
  } catch (error) {
    log.warn('S3 delete failed; proceeding with DB soft-delete anyway', {
      id: String(id),
      storagePath: existing.storagePath,
      error,
    })
  }

  const deleted = await softDeleteImage(id)
  if (deleted === null) {
    throw new ActionFailure(404, '图片不存在')
  }
  await invalidateImageEnhanceCacheFor(deleted.storagePath)
}

export async function updateImageNote(
  id: bigint,
  note: string | null,
  viewer?: ImageViewerContext,
): Promise<AdminImageDto> {
  const existing = await findImageById(id)
  if (existing === null) {
    throw new ActionFailure(404, '图片不存在')
  }
  if (viewer && !canEditImage(viewer, existing)) {
    throw new ActionFailure(404, ErrorMessages.NOT_FOUND)
  }
  const updated = await updateImageNoteWithUploader(id, note)
  if (updated === null) {
    throw new ActionFailure(404, '图片不存在')
  }
  return toAdminImageDto(updated, updated.uploaderName)
}

export async function recalculateImageThumbhash(id: bigint, viewer?: ImageViewerContext): Promise<AdminImageDto> {
  const existing = await findAdminImageRowById(id)
  if (existing === null) {
    throw new ActionFailure(404, '图片不存在')
  }
  if (viewer && !canEditImage(viewer, existing)) {
    throw new ActionFailure(404, ErrorMessages.NOT_FOUND)
  }

  let buffer: Buffer
  try {
    buffer = await getImage(existing.storagePath)
  } catch (error) {
    if (error instanceof ActionFailure && error.status === 404) {
      throw new ActionFailure(404, 'S3 中未找到该图片对象')
    }
    const errorDetail =
      error instanceof Error ? { errorName: error.name, errorMessage: error.message } : { errorRaw: String(error) }
    log.error('Failed to fetch image from S3 for thumbhash recalculation', {
      id: String(id),
      storagePath: existing.storagePath,
      ...errorDetail,
    })
    throw new ActionFailure(503, '从 S3 获取图片失败，请检查存储配置')
  }

  const processed = await processImageBuffer({
    buffer,
    jpegQuality: 82,
  })

  const updated = await updateImageThumbhashWithUploader(id, processed.thumbhash)
  if (updated === null) {
    throw new ActionFailure(404, '图片不存在')
  }

  await invalidateImageEnhanceCacheFor(existing.storagePath)

  return toAdminImageDto(updated, updated.uploaderName)
}

export async function findImageDtoById(id: bigint): Promise<AdminImageDto | null> {
  const row = await findAdminImageRowById(id)
  if (row === null) {
    return null
  }
  return toAdminImageDto(row, row.uploaderName)
}

/** Bulk lookup used by the SSR enhancer. Drops soft-deleted rows. */
export async function bulkFindImagesByStoragePaths(paths: readonly string[]): Promise<Map<string, ImageRow>> {
  const rows = await findImagesByStoragePaths(paths)
  const out = new Map<string, ImageRow>()
  for (const row of rows) {
    out.set(row.storagePath, row)
  }
  return out
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toKeySpec(kind: UploadKind): ImageKindSpec {
  switch (kind.kind) {
    case 'generic':
      return { kind: 'generic', now: new Date() }
    case 'category':
      return { kind: 'category', slug: kind.slug }
    case 'friend':
      return { kind: 'friend', host: kind.host }
  }
}

export function toAdminImageDto(row: ImageRow, uploaderName: string | null): AdminImageDto {
  return {
    id: String(row.id),
    kind: classifyImageKind(row.storagePath),
    storagePath: row.storagePath,
    publicUrl: resolvePublicUrl(row),
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    byteSize: row.byteSize,
    thumbhash: row.thumbhash ?? null,
    uploaderId: row.uploaderId === null ? null : String(row.uploaderId),
    uploaderName,
    note: row.note ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function resolvePublicUrl(row: ImageRow): string {
  // Build the S3 URL with a `?v=<updatedAt-epoch>` cache-buster so a
  // re-upload to the same key forces CDNs and browsers to refetch
  // immediately. The settings page is responsible for `publicBaseUrl`
  // pointing at the actual public host.
  try {
    const base = buildPublicUrl(row.storagePath)
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}v=${row.updatedAt.getTime()}`
  } catch (error) {
    if (error instanceof ActionFailure) {
      // Settings missing — fall back to a relative path so the admin
      // table at least shows the storage key. The form copy already
      // points the operator at /wp-admin/settings/assets.
      return row.storagePath
    }
    throw error
  }
}

function clampOffset(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return 0
  }
  return Math.floor(value)
}

function clampLimit(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return 20
  }
  if (value > 200) {
    return 200
  }
  return Math.floor(value)
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
