import type { ImgHTMLAttributes, Ref } from 'react'

import { useEffect, useState } from 'react'

import { api } from '@/client/api/client'
import { useThumbhashBackground } from '@/client/hooks/use-thumbhash-bg'
import { getImageSrcset } from '@/shared/images'
import { useAssetsSettings } from '@/ui/lib/blog-config-context'
import { cn } from '@/ui/lib/cn'
import { useImageMeta } from '@/ui/pt/image-meta-context'
import { DARK_IMAGE_DIM_CLASS } from '@/ui/public/widgets/Image'
import { useImageLoaded } from '@/ui/public/widgets/use-image-loaded'

// `<img>` override for PortableText image blocks. Wires the thumbhash
// placeholder into the tree and lazily resolves missing hashes through a
// small GET endpoint, cached by image `src`.
export type BlockImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'ref'> & {
  'data-thumbhash'?: string
  ref?: Ref<HTMLImageElement>
}

interface ResolvedImageMeta {
  thumbhash?: string
  width?: number
  height?: number
}

// Cap the cache so a long-running tab that browses through many posts
// doesn't keep every resolved thumbhash in memory. The eviction
// behaviour is insertion-order: when the cap is hit, the oldest entry
// drops out so the newest can land. We don't bother with true LRU
// (touching a key on read to move it to the end) — same-page revisits
// would defeat eviction anyway because the resolved meta is also held
// by the rendered component's state, so the cache is only consulted
// on the first paint of a new instance.
const META_CACHE_LIMIT = 256
const imageMetaBySrcCache = new Map<string, ResolvedImageMeta>()

function setImageMetaCache(src: string, meta: ResolvedImageMeta): void {
  if (!imageMetaBySrcCache.has(src) && imageMetaBySrcCache.size >= META_CACHE_LIMIT) {
    const oldest = imageMetaBySrcCache.keys().next().value
    if (oldest !== undefined) {
      imageMetaBySrcCache.delete(oldest)
    }
  }
  imageMetaBySrcCache.set(src, meta)
}

export function BlockImage({
  alt = '',
  loading = 'lazy',
  decoding = 'async',
  style,
  onLoad,
  ref: externalRef,
  ...rest
}: BlockImageProps) {
  const src = typeof rest.src === 'string' ? rest.src : undefined
  const imageMeta = useImageMeta()
  const meta = src ? imageMeta?.[src] : undefined
  const { asset, storage } = useAssetsSettings()

  const initialWidth = readPositiveNumber(rest.width) ?? meta?.width
  const initialHeight = readPositiveNumber(rest.height) ?? meta?.height
  const initialThumbhash = rest['data-thumbhash'] ?? meta?.thumbhash
  const [thumbhash, setThumbhash] = useState<string | undefined>(initialThumbhash)
  const [width, setWidth] = useState<number | undefined>(initialWidth)
  const [height, setHeight] = useState<number | undefined>(initialHeight)
  const { ref: setRef, loaded, handleLoad } = useImageLoaded(externalRef, onLoad)

  const srcset =
    src !== undefined && width !== undefined && height !== undefined
      ? getImageSrcset({
          src,
          width,
          height,
          assetHost: asset.host,
          urlTemplate: storage.urlTemplate,
          breakpoints: [256, 512, 768, 1024],
        })
      : undefined

  useEffect(() => {
    setThumbhash(initialThumbhash)
    setWidth(initialWidth)
    setHeight(initialHeight)
  }, [initialThumbhash, initialWidth, initialHeight])

  useEffect(() => {
    if (thumbhash !== undefined && thumbhash !== '' && width !== undefined && height !== undefined) {
      return
    }
    if (src === undefined || src === '' || src.startsWith('data:')) {
      return
    }
    const cached = imageMetaBySrcCache.get(src)
    if (cached !== undefined) {
      if (cached.thumbhash !== undefined) {
        setThumbhash(cached.thumbhash)
      }
      if (cached.width !== undefined) {
        setWidth(cached.width)
      }
      if (cached.height !== undefined) {
        setHeight(cached.height)
      }
      return
    }

    let cancelled = false
    void api.image
      .resolveThumbhash({ query: { src } })
      .then((res) => {
        if (cancelled || res.status !== 200) return
        const data = res.body
        const next: ResolvedImageMeta = {}
        if (typeof data.thumbhash === 'string' && data.thumbhash !== '') {
          next.thumbhash = data.thumbhash
          setThumbhash(data.thumbhash)
        }
        if (typeof data.width === 'number' && data.width > 0) {
          next.width = data.width
          setWidth(data.width)
        }
        if (typeof data.height === 'number' && data.height > 0) {
          next.height = data.height
          setHeight(data.height)
        }
        if (next.thumbhash !== undefined || next.width !== undefined || next.height !== undefined) {
          setImageMetaCache(src, next)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [thumbhash, width, height, src])

  const thumbhashStyle = useThumbhashBackground(thumbhash, loaded)
  const mergedStyle =
    thumbhashStyle === undefined ? style : style === undefined ? thumbhashStyle : { ...thumbhashStyle, ...style }

  const { className, ...imgRest } = rest
  return (
    <img
      {...imgRest}
      ref={setRef}
      width={imgRest.width ?? width}
      height={imgRest.height ?? height}
      alt={alt}
      loading={loading}
      decoding={decoding}
      sizes="100vw"
      srcSet={srcset}
      className={cn(DARK_IMAGE_DIM_CLASS, className)}
      style={mergedStyle}
      onLoad={handleLoad}
    />
  )
}

function readPositiveNumber(value: ImgHTMLAttributes<HTMLImageElement>['width']): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }
  return undefined
}
