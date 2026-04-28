import { ELEMENT_NODE, transform, walk } from 'ultrahtml'

import { createInflight } from '@/server/cache/inflight'
import {
  isImageMetadataRemoteFallbackEnabled,
  metadataJsonUrlForImageSrc,
  readCommittedImageMetadata,
} from '@/server/images/metadata-store'
import { getImageUrl, isTransformableRemoteImage } from '@/shared/image-url'

interface ImageMetadata {
  width: number
  height: number
  blurhash?: string
}

export interface ImageThumbhash {
  width: number
  height: number
  thumbhash?: string
}

const METADATA_FETCH_TIMEOUT_MS = 1500
const metadataInflight = createInflight<ImageMetadata | null>()

export async function loadImageThumbhash(src: string): Promise<ImageThumbhash | null> {
  if (!isTransformableRemoteImage(src)) {
    return null
  }

  const metadata = await getImageMetadata(src)
  return metadata === null ? null : toThumbhash(metadata)
}

export async function enhanceImageHtml(html: string): Promise<string> {
  return transform(html, [
    async (node) => {
      const pending: Promise<void>[] = []
      await walk(node, (node) => {
        if (node.type !== ELEMENT_NODE || node.name !== 'img') {
          return
        }

        pending.push(enhanceImageNode(node.attributes))
      })
      await Promise.all(pending)
      return node
    },
  ])
}

async function getImageMetadata(src: string): Promise<ImageMetadata | null> {
  return metadataInflight(src, () => loadImageMetadata(src))
}

async function loadImageMetadata(src: string): Promise<ImageMetadata | null> {
  const committed = await readCommittedImageMetadata(src)
  if (committed !== null) {
    return {
      width: committed.width,
      height: committed.height,
      blurhash: committed.blurhash,
    }
  }

  if (!isImageMetadataRemoteFallbackEnabled()) {
    return null
  }

  const remoteUrl = metadataJsonUrlForImageSrc(src)
  if (remoteUrl === null) {
    return null
  }

  try {
    const response = await fetch(remoteUrl, {
      signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      return null
    }

    const metadata = (await response.json()) as ImageMetadata
    if (!isValidMetadata(metadata)) {
      return null
    }

    return metadata
  } catch {
    return null
  }
}

function toThumbhash(metadata: ImageMetadata): ImageThumbhash | null {
  if (!isValidMetadata(metadata)) {
    return null
  }

  return {
    width: metadata.width,
    height: metadata.height,
    thumbhash: metadata.blurhash === undefined || metadata.blurhash === '' ? undefined : metadata.blurhash,
  }
}

function isValidMetadata(
  metadata: ImageMetadata,
): metadata is Required<Pick<ImageMetadata, 'width' | 'height'>> & ImageMetadata {
  return (
    Number.isFinite(metadata.width) && metadata.width > 0 && Number.isFinite(metadata.height) && metadata.height > 0
  )
}

async function enhanceImageNode(attributes: Record<string, string | undefined>): Promise<void> {
  const src = attributes.src
  if (src === undefined || src === '') {
    return
  }

  const metadata = await loadImageThumbhash(src)
  const width = readPositiveInteger(attributes.width) ?? metadata?.width
  const height = readPositiveInteger(attributes.height) ?? metadata?.height

  if (metadata?.thumbhash !== undefined) {
    attributes['data-thumbhash'] = metadata.thumbhash
  }
  if (width !== undefined) {
    attributes.width = `${width}`
  }
  if (height !== undefined) {
    attributes.height = `${height}`
  }
  if (width !== undefined && height !== undefined) {
    attributes.src = getImageUrl({ src, width, height })
  }
}

function readPositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined || value === '') {
    return undefined
  }

  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) && number > 0 ? number : undefined
}
