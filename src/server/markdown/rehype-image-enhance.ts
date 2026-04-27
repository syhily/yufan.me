import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { visit } from 'unist-util-visit'

// Compile-time replacement for the runtime `enhanceImageHtml` /
// `resolveContentImageEnhancements` pipeline. Walks the MDX hast tree,
// resolves thumbhash + dimensions for every transformable `<img src>` and
// inlines the resulting attributes (`width`, `height`, `data-thumbhash`,
// rewritten upyun `src`) so SSR/hydration don't need to scan the body or
// fetch metadata at request time.
//
// Runs once per MDX compilation (Fumadocs MDX caches the build output to
// `.source/`), keeping the production hot path zero-cost. Kept intentionally
// dependency-free (no `@/` aliases, no Redis, no Vite-only modules) so it
// can be safely loaded by `vite.config.ts` before aliases are wired up.

const ASSET_HOST = 'cat.yufan.me'
const METADATA_FETCH_TIMEOUT_MS = 800
const METADATA_FETCH_CONCURRENCY = 16
const METADATA_DISK_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const METADATA_DISK_CACHE_DIR = resolve(process.cwd(), '.cache/mdx-image-metadata')
const NEGATIVE_TTL_MS = 60_000

interface ImageMetadata {
  width: number
  height: number
  blurhash?: string
}

interface CachedImageMetadata extends ImageMetadata {
  src: string
  cachedAt: number
}

interface ImageEnhancement {
  width: number
  height: number
  thumbhash?: string
}

// Two-tier cache: in-memory map (per-process) on top of the disk cache
// under `.cache/mdx-image-metadata` (persisted across restarts). The
// in-memory tier is what makes `vp dev` iterative editing snappy — once
// an image's metadata has been resolved during this process's lifetime,
// re-recompiling the surrounding MDX doesn't re-touch disk for it. The
// disk tier still backs cold starts and CI builds.
const metadataCache = new Map<string, Promise<ImageMetadata | null>>()
const negativeCacheUntil = new Map<string, number>()
const metadataFetchQueue: Array<() => void> = []

let activeMetadataFetches = 0

export const rehypeImageEnhance: Plugin<[], Root> = () => {
  return async (tree) => {
    const targets: Element[] = []
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'img') {
        return
      }
      const src = readStringProp(node, 'src')
      if (src === undefined || !isTransformableRemoteImage(src)) {
        return
      }
      targets.push(node)
    })

    await Promise.all(
      targets.map(async (node) => {
        const src = readStringProp(node, 'src')
        if (src === undefined) {
          return
        }
        const enhancement = await loadEnhancement(src)
        if (enhancement === null) {
          return
        }
        applyEnhancement(node, src, enhancement)
      }),
    )
  }
}

function readStringProp(node: Element, key: string): string | undefined {
  const value = node.properties?.[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

function readNumericProp(node: Element, key: string): number | undefined {
  const value = node.properties?.[key]
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }
  if (typeof value === 'string' && value !== '') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }
  return undefined
}

function applyEnhancement(node: Element, src: string, enhancement: ImageEnhancement): void {
  const properties = (node.properties ??= {})
  const width = readNumericProp(node, 'width') ?? enhancement.width
  const height = readNumericProp(node, 'height') ?? enhancement.height

  if (width !== undefined) {
    properties.width = width
  }
  if (height !== undefined) {
    properties.height = height
  }
  if (enhancement.thumbhash !== undefined && enhancement.thumbhash !== '') {
    properties.dataThumbhash = enhancement.thumbhash
  }
  if (width !== undefined && height !== undefined) {
    properties.src = upyunUrl(src, width, height)
  }
}

function isTransformableRemoteImage(src: string): boolean {
  if (src.startsWith('data:')) {
    return false
  }
  try {
    const url = new URL(src)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname === ASSET_HOST &&
      !url.pathname.includes('!upyun520/')
    )
  } catch {
    return false
  }
}

function upyunUrl(src: string, width: number, height: number, quality = 100): string {
  return `${src}!upyun520/both/${width}x${height}/format/webp/quality/${quality}/unsharp/true/progressive/true`
}

async function loadEnhancement(src: string): Promise<ImageEnhancement | null> {
  const metadata = await getCachedMetadata(src)
  if (metadata === null) {
    return null
  }
  return {
    width: metadata.width,
    height: metadata.height,
    thumbhash: metadata.blurhash === undefined || metadata.blurhash === '' ? undefined : metadata.blurhash,
  }
}

function getCachedMetadata(src: string): Promise<ImageMetadata | null> {
  const negativeUntil = negativeCacheUntil.get(src)
  if (negativeUntil !== undefined && Date.now() < negativeUntil) {
    return Promise.resolve(null)
  }
  let pending = metadataCache.get(src)
  if (pending === undefined) {
    pending = loadMetadata(src).then((value) => {
      if (value === null) {
        negativeCacheUntil.set(src, Date.now() + NEGATIVE_TTL_MS)
        metadataCache.delete(src)
      }
      return value
    })
    metadataCache.set(src, pending)
  }
  return pending
}

async function loadMetadata(src: string): Promise<ImageMetadata | null> {
  const cached = await readDiskMetadata(src)
  if (cached !== null) {
    return toImageMetadata(cached)
  }

  const metadata = await fetchMetadata(src)
  if (metadata !== null) {
    await writeDiskMetadata({ ...metadata, src, cachedAt: Date.now() })
  }
  return metadata
}

async function fetchMetadata(src: string): Promise<ImageMetadata | null> {
  return withMetadataFetchSlot(async () => {
    try {
      const response = await fetch(metadataUrl(src), {
        signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS),
      })
      if (!response.ok) {
        return null
      }
      const metadata = await response.json()
      if (!isValidMetadata(metadata)) {
        return null
      }
      return metadata
    } catch {
      return null
    }
  })
}

async function withMetadataFetchSlot<T>(task: () => Promise<T>): Promise<T> {
  await acquireMetadataFetchSlot()
  try {
    return await task()
  } finally {
    releaseMetadataFetchSlot()
  }
}

async function acquireMetadataFetchSlot(): Promise<void> {
  if (activeMetadataFetches < METADATA_FETCH_CONCURRENCY) {
    activeMetadataFetches += 1
    return
  }
  await new Promise<void>((resolve) => metadataFetchQueue.push(resolve))
}

function releaseMetadataFetchSlot(): void {
  const next = metadataFetchQueue.shift()
  if (next !== undefined) {
    next()
    return
  }
  activeMetadataFetches -= 1
}

async function readDiskMetadata(src: string): Promise<CachedImageMetadata | null> {
  try {
    const raw = await readFile(metadataDiskCachePath(src), 'utf8')
    const parsed = JSON.parse(raw)
    if (!isCachedImageMetadata(parsed)) {
      return null
    }
    if (parsed.src !== src || !isFreshCachedMetadata(parsed)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

async function writeDiskMetadata(metadata: CachedImageMetadata): Promise<void> {
  await mkdir(METADATA_DISK_CACHE_DIR, { recursive: true })
  await writeFile(metadataDiskCachePath(metadata.src), `${JSON.stringify(metadata)}\n`)
}

function isValidMetadata(metadata: unknown): metadata is ImageMetadata {
  if (!isRecord(metadata)) {
    return false
  }
  return (
    typeof metadata.width === 'number' &&
    Number.isFinite(metadata.width) &&
    metadata.width > 0 &&
    typeof metadata.height === 'number' &&
    Number.isFinite(metadata.height) &&
    metadata.height > 0 &&
    (metadata.blurhash === undefined || typeof metadata.blurhash === 'string')
  )
}

function isCachedImageMetadata(metadata: unknown): metadata is CachedImageMetadata {
  if (!isValidMetadata(metadata) || !isRecord(metadata)) {
    return false
  }
  return (
    typeof metadata.src === 'string' &&
    metadata.src !== '' &&
    typeof metadata.cachedAt === 'number' &&
    Number.isFinite(metadata.cachedAt) &&
    metadata.cachedAt > 0
  )
}

function isFreshCachedMetadata(metadata: CachedImageMetadata, now = Date.now()): boolean {
  return now - metadata.cachedAt < METADATA_DISK_CACHE_TTL_MS
}

function toImageMetadata(metadata: CachedImageMetadata): ImageMetadata {
  const { cachedAt: _cachedAt, ...imageMetadata } = metadata
  return imageMetadata
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function metadataDiskCachePath(src: string): string {
  const key = createHash('sha256').update(src).digest('hex')
  return resolve(METADATA_DISK_CACHE_DIR, `${key}.json`)
}

function metadataUrl(src: string): string {
  const extensionIndex = src.lastIndexOf('.')
  if (extensionIndex === -1) {
    return `${src}.json`
  }
  return `${src.slice(0, extensionIndex)}.json`
}
