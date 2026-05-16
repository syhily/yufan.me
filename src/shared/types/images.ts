// Wire-format DTOs for the admin image-management endpoints. Mirrors
// the friends/categories/tags DTO style: bigints stringified, public
// projection separate from row-level fields, paginated list responses
// carry an explicit `total` so the table can render the pager without
// re-counting on the client.
//
// The `kind` derived field is computed from `storagePath`'s prefix:
//   - `images/categories/...` → `category`
//   - `images/links/...`      → `friend`
//   - everything else under `images/...` → `generic`
// keeping the render side free from a separate kind column on the
// table.
//
// Every row in the `image` table represents an object uploaded into
// the configured S3-compatible bucket via the admin "图片管理"
// surface; there is no other origin (the historical `external` row
// type was retired together with its sidecar JSON importer).

export type AdminImageKind = 'generic' | 'category' | 'friend'

export interface AdminImageDto {
  id: string
  kind: AdminImageKind
  storagePath: string
  publicUrl: string
  mimeType: string
  width: number
  height: number
  byteSize: number
  thumbhash: string | null
  uploaderId: string | null
  /**
   * Display name of the user who uploaded the image. `null` when the
   * uploader was never recorded (historical rows imported before the
   * column existed) or the uploader's row was hard-deleted; the admin
   * table renders `—` in that case.
   */
  uploaderName: string | null
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface ListImagesInput {
  q?: string
  kind?: AdminImageKind | 'all'
  offset?: number
  limit?: number
}

export interface ListImagesOutput {
  images: AdminImageDto[]
  /** Total rows matching the filter (independent of `offset`/`limit`). */
  total: number
  hasMore: boolean
}

// Multipart upload payload. The wire-format envelope is documented here
// for reference; the actual transport is `multipart/form-data` because
// JSON request bodies cannot carry binary Blob entries.
//
// Required fields:
//   - `kind` — discriminator, validated server-side
//   - `file` — the JPEG blob (sent as a Blob entry)
//
// Discriminator-conditional fields:
//   - `slug` — required when `kind === 'category'`
//   - `host` — required when `kind === 'friend'`
//
// Optional:
//   - `note` — admin-facing memo (also searchable on `storage_path` / `note`)
export interface UploadImageInput {
  kind: 'generic' | 'category' | 'friend'
  slug?: string
  host?: string
  note?: string
}

export interface UploadImageOutput {
  image: AdminImageDto
}

export interface DeleteImageInput {
  id: string
}

export interface DeleteImageOutput {
  success: true
}

export interface UpdateImageNoteInput {
  id: string
  note: string | null
}

export interface UpdateImageNoteOutput {
  image: AdminImageDto
}

export interface RecalculateThumbhashInput {
  id: string
}

export interface RecalculateThumbhashOutput {
  image: AdminImageDto
}

/** Pure client-friendly classifier so the table column doesn't have to import server code. */
export function classifyImageKind(storagePath: string): AdminImageKind {
  if (storagePath.startsWith('images/categories/')) {
    return 'category'
  }
  if (storagePath.startsWith('images/links/')) {
    return 'friend'
  }
  return 'generic'
}

const SAFE_PATH_SEGMENT = /^[a-z0-9._-]+$/

/**
 * Isomorphic host extractor used by client-side cover dialogs to
 * preview the upload target before invoking the server. Mirrors
 * `extractHostForFriendKey` in `@/server/domains/images/key`, but returns
 * `null` instead of throwing so the form can disable the upload
 * button without crashing.
 */
export function extractFriendHostSafe(homepage: string): string | null {
  const trimmed = homepage.trim()
  if (trimmed === '') {
    return null
  }
  let host: string
  try {
    host = new URL(trimmed).hostname.toLowerCase()
  } catch {
    return null
  }
  if (host === '' || !SAFE_PATH_SEGMENT.test(host)) {
    return null
  }
  return host
}

/**
 * Slug validator for category covers. Categories already enforce a
 * lowercase ASCII slug pattern at the form layer, but the cover row
 * still wants to know whether the current value is safe to embed in
 * an S3 key before enabling the upload button.
 */
export function isSafeImageSegment(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === '') {
    return false
  }
  return SAFE_PATH_SEGMENT.test(trimmed)
}

/**
 * Compute the public-facing base URL the runtime uses to address an
 * uploaded image from the `assets` settings section: `assets.asset`
 * provides host+scheme, and `assets.storage.enabled` gates
 * uploadability. The server's render-enhancer keeps an authoritative
 * copy of this logic (see `@/server/domains/images/storage.getPublicBaseUrl`);
 * this isomorphic mirror is what the admin "preview the auto-managed
 * cover URL" helpers in `EditFriendDialog` / `EditCategoryDialog` rely
 * on so the preview stays in sync without crossing the server import
 * boundary.
 *
 * Returns `null` when inputs are missing or when uploads are disabled —
 * callers treat that as "no preview, keep upload disabled".
 */
export function buildPublicBaseUrlFromStorage(
  options:
    | {
        storageEnabled: boolean
        asset: { host: string; scheme: 'http' | 'https' }
      }
    | undefined,
): string | null {
  if (options === undefined) {
    return null
  }
  if (!options.storageEnabled) {
    return null
  }
  const trimmed = options.asset.host.replace(/\/$/, '')
  return trimmed === '' ? null : `${options.asset.scheme}://${trimmed}`
}

export interface ImageUrlOptions {
  src: string
  width: number
  height: number
  quality?: number
  assetHost: string
  /**
   * Transform template for remote images hosted on `assetHost`.
   *
   * Supported placeholders:
   *   - `{src}`     absolute source URL (optional; if omitted, template is appended to src)
   *   - `{width}`   requested width
   *   - `{height}`  requested height
   *   - `{quality}` jpeg/webp quality, defaults to 100
   */
  urlTemplate?: string
}

const DEFAULT_SRCSET_BREAKPOINTS = [256, 512, 768, 1024, 1280, 1536]

export function getImageUrl({ src, width, height, quality, assetHost, urlTemplate }: ImageUrlOptions): string {
  if (!isTransformableRemoteImage(src, assetHost)) {
    return src
  }

  const template = (urlTemplate ?? '').trim()
  if (template === '') {
    return src
  }

  const imageQuality = typeof quality === 'number' ? quality : 100
  const rendered = template
    .replaceAll('{width}', String(width))
    .replaceAll('{height}', String(height))
    .replaceAll('{quality}', String(imageQuality))

  // Extract any query string from src so it can be re-appended at the end
  // after the transform template. This prevents cache-buster params like
  // ?v=... from landing in the middle of the URL (e.g. before a !upyun520
  // processing suffix).
  const qIndex = src.indexOf('?')
  const srcPath = qIndex >= 0 ? src.slice(0, qIndex) : src
  const search = qIndex >= 0 ? src.slice(qIndex) : ''

  let url: string
  if (rendered.includes('{src}')) {
    url = rendered.replaceAll('{src}', srcPath)
  } else {
    url = `${srcPath}${rendered}`
  }

  if (search === '') {
    return url
  }
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${search.slice(1)}`
}

export interface ImageSrcsetOptions extends ImageUrlOptions {
  breakpoints?: number[]
}

export function getImageSrcset({
  src,
  width,
  height,
  quality,
  assetHost,
  urlTemplate,
  breakpoints,
}: ImageSrcsetOptions): string {
  if (!isTransformableRemoteImage(src, assetHost)) {
    return ''
  }

  const template = (urlTemplate ?? '').trim()
  if (template === '') {
    return ''
  }

  const bps = breakpoints ?? DEFAULT_SRCSET_BREAKPOINTS
  const maxWidth = Math.max(width * 2, 1536)
  const ratio = height / width

  return bps
    .filter((w) => w <= maxWidth)
    .map((w) => {
      const h = Math.round(w * ratio)
      const url = getImageUrl({ src, width: w, height: h, quality, assetHost, urlTemplate })
      return `${url} ${w}w`
    })
    .join(', ')
}

export function isTransformableRemoteImage(src: string, assetHost: string): boolean {
  if (src.startsWith('data:')) {
    return false
  }

  try {
    const url = new URL(src)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname === assetHost
  } catch {
    return false
  }
}
