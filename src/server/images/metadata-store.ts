import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Read the asset host from `process.env` *lazily*. This module is
// loaded from `rehype-image-enhance.ts` while Vite is still processing
// `source.config.ts`, before `@/` aliases (or even the t3-env wrapper)
// are wired up — and crucially before Vite has loaded `.env`. We defer
// the `ASSET_HOST` lookup until first use so `vite.config.ts` itself
// can be parsed by `vp check` without setting the variable manually.
// The DB-backed runtime config reads the same value via
// `getBlogConfigSync()`; the env var and the admin-edited setting MUST
// stay in sync at deploy time. See `src/server/env.ts` for the schema.
function getAssetHost(): string {
  const value = process.env.ASSET_HOST
  if (!value) {
    throw new Error('ASSET_HOST environment variable is required (see .env.example).')
  }
  return value
}

/** Root for committed per-image metadata JSON (mirrors CDN path under /images/...). */
const COMMITTED_METADATA_ROOT = resolve(process.cwd(), 'src/content/image-metadata')

export interface ImageMetadataRecord {
  width: number
  height: number
  blurhash?: string
}

/** When not set, remote `*.json` metadata is never fetched (build + SSR use repo files only). */
export function isImageMetadataRemoteFallbackEnabled(): boolean {
  return process.env.IMAGE_METADATA_REMOTE_FALLBACK === '1'
}

function stripUrlNoise(src: string): string {
  try {
    const url = new URL(src)
    url.hash = ''
    url.search = ''
    return url.toString()
  } catch {
    return src
  }
}

/** Same host/path rules as `isTransformableRemoteImage` in `@/shared/image-url`. */
export function isCommittedMetadataHostUrl(src: string): boolean {
  if (src.startsWith('data:')) return false
  try {
    const url = new URL(stripUrlNoise(src))
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname === getAssetHost() &&
      !url.pathname.includes('!upyun520/')
    )
  } catch {
    return false
  }
}

/**
 * Remote sidecar metadata URL (upyun JSON next to the image).
 * Example: `https://cat.yufan.me/images/a.jpg` → `https://cat.yufan.me/images/a.json`
 */
export function metadataJsonUrlForImageSrc(src: string): string | null {
  if (!isCommittedMetadataHostUrl(src)) return null
  const normalized = stripUrlNoise(src)
  const extensionIndex = normalized.lastIndexOf('.')
  if (extensionIndex === -1) return `${normalized}.json`
  return `${normalized.slice(0, extensionIndex)}.json`
}

/**
 * Repo path for committed metadata: `src/content/image-metadata` + pathname + `.json`
 * Example: `https://cat.yufan.me/images/2025/a.jpg` → `.../src/content/image-metadata/images/2025/a.jpg.json`
 */
export function committedImageMetadataFilePath(src: string): string | null {
  if (!isCommittedMetadataHostUrl(src)) return null
  try {
    const pathname = new URL(stripUrlNoise(src)).pathname
    if (!pathname.startsWith('/') || pathname.length < 2) return null
    const relativePath = pathname.slice(1)
    return resolve(COMMITTED_METADATA_ROOT, `${relativePath}.json`)
  } catch {
    return null
  }
}

export function parseImageMetadataRecord(raw: unknown): ImageMetadataRecord | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const width = o.width
  const height = o.height
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) return null
  if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) return null
  const blurhash = o.blurhash
  if (blurhash !== undefined && typeof blurhash !== 'string') return null
  return {
    width,
    height,
    blurhash: blurhash === undefined || blurhash === '' ? undefined : blurhash,
  }
}

export async function readCommittedImageMetadata(src: string): Promise<ImageMetadataRecord | null> {
  const filePath = committedImageMetadataFilePath(src)
  if (filePath === null) return null
  try {
    const text = await readFile(filePath, 'utf8')
    return parseImageMetadataRecord(JSON.parse(text) as unknown)
  } catch {
    return null
  }
}
