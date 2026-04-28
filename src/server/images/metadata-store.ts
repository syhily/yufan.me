import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Relative import so this module stays resolvable from `rehype-image-enhance.ts`
// when Vite loads `source.config.ts` before `@/` aliases exist.
import config from '../../blog.config.ts'

const assetHost = config.settings.asset.host

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
      url.hostname === assetHost &&
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
