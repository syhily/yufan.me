import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'

import { visit } from 'unist-util-visit'

import {
  isCommittedMetadataHostUrl,
  isImageMetadataRemoteFallbackEnabled,
  metadataJsonUrlForImageSrc,
  readCommittedImageMetadata,
} from '../images/metadata-store.ts'

// Compile-time replacement for the runtime `enhanceImageHtml` /
// `resolveContentImageEnhancements` pipeline. Walks the MDX hast tree,
// resolves thumbhash + dimensions for every transformable `<img src>` and
// inlines the resulting attributes (`width`, `height`, `data-thumbhash`,
// rewritten upyun `src`) so SSR/hydration don't need to scan the body or
// fetch metadata at request time.
//
// Runs once per MDX compilation (Fumadocs MDX caches the build output to
// `.source/`), keeping the production hot path zero-cost. Reads committed
// metadata from `src/content/image-metadata/**`; optional remote fetch only
// when `IMAGE_METADATA_REMOTE_FALLBACK=1`.

const METADATA_FETCH_TIMEOUT_MS = 800
const METADATA_FETCH_CONCURRENCY = 16

interface ImageMetadata {
  width: number
  height: number
  blurhash?: string
}

interface ImageEnhancement {
  width: number
  height: number
  thumbhash?: string
}

// In-flight dedupe only: entries are removed when the promise settles so a later
// MDX recompile can pick up newly committed metadata files without restarting dev.
const metadataInflight = new Map<string, Promise<ImageMetadata | null>>()
const metadataFetchQueue: Array<() => void> = []

let activeMetadataFetches = 0

export const rehypeImageEnhance: Plugin<[], Root> = () => {
  return async (tree) => {
    const targets: Element[] = []
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'img') return
      const src = readStringProp(node, 'src')
      if (src === undefined || !isCommittedMetadataHostUrl(src)) return
      targets.push(node)
    })

    await Promise.all(
      targets.map(async (node) => {
        const src = readStringProp(node, 'src')
        if (src === undefined) return
        const enhancement = await loadEnhancement(src)
        if (enhancement === null) return
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
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string' && value !== '') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return undefined
}

function applyEnhancement(node: Element, src: string, enhancement: ImageEnhancement): void {
  const properties = (node.properties ??= {})
  const width = readNumericProp(node, 'width') ?? enhancement.width
  const height = readNumericProp(node, 'height') ?? enhancement.height

  if (width !== undefined) properties.width = width
  if (height !== undefined) properties.height = height
  if (enhancement.thumbhash !== undefined && enhancement.thumbhash !== '') {
    properties.dataThumbhash = enhancement.thumbhash
  }
  if (width !== undefined && height !== undefined) {
    properties.src = upyunUrl(src, width, height)
  }
}

function upyunUrl(src: string, width: number, height: number, quality = 100): string {
  return `${src}!upyun520/both/${width}x${height}/format/webp/quality/${quality}/unsharp/true/progressive/true`
}

async function loadEnhancement(src: string): Promise<ImageEnhancement | null> {
  const metadata = await getInflightMetadata(src)
  if (metadata === null) return null
  return {
    width: metadata.width,
    height: metadata.height,
    thumbhash: metadata.blurhash === undefined || metadata.blurhash === '' ? undefined : metadata.blurhash,
  }
}

function getInflightMetadata(src: string): Promise<ImageMetadata | null> {
  let pending = metadataInflight.get(src)
  if (pending === undefined) {
    pending = loadMetadata(src).finally(() => {
      metadataInflight.delete(src)
    })
    metadataInflight.set(src, pending)
  }
  return pending
}

async function loadMetadata(src: string): Promise<ImageMetadata | null> {
  const fromRepo = await readCommittedImageMetadata(src)
  if (fromRepo !== null) {
    return {
      width: fromRepo.width,
      height: fromRepo.height,
      blurhash: fromRepo.blurhash,
    }
  }

  if (!isImageMetadataRemoteFallbackEnabled()) {
    return null
  }

  return fetchMetadata(src)
}

async function fetchMetadata(src: string): Promise<ImageMetadata | null> {
  const jsonUrl = metadataJsonUrlForImageSrc(src)
  if (jsonUrl === null) return null
  return withMetadataFetchSlot(async () => {
    try {
      const response = await fetch(jsonUrl, {
        signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS),
      })
      if (!response.ok) return null
      const metadata = await response.json()
      if (!isValidMetadata(metadata)) return null
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

function isValidMetadata(metadata: unknown): metadata is ImageMetadata {
  if (!isRecord(metadata)) return false
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
