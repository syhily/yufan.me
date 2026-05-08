import type { ImgHTMLAttributes, Ref } from 'react'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useThumbhashBackground } from '@/client/hooks/use-thumbhash-bg'
import { API_ACTIONS } from '@/shared/api-actions'
import { useImageMeta } from '@/ui/pt/image-meta-context'

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

const imageMetaBySrcCache = new Map<string, ResolvedImageMeta>()

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

  const initialWidth = readPositiveNumber(rest.width) ?? meta?.width
  const initialHeight = readPositiveNumber(rest.height) ?? meta?.height
  const initialThumbhash = rest['data-thumbhash'] ?? meta?.thumbhash
  const [thumbhash, setThumbhash] = useState<string | undefined>(initialThumbhash)
  const [width, setWidth] = useState<number | undefined>(initialWidth)
  const [height, setHeight] = useState<number | undefined>(initialHeight)
  const [loaded, setLoaded] = useState(false)

  const imgRef = useRef<HTMLImageElement | null>(null)

  useLayoutEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true)
    }
  }, [])

  const setRef = useCallback(
    (node: HTMLImageElement | null) => {
      imgRef.current = node
      if (typeof externalRef === 'function') {
        externalRef(node)
      } else if (externalRef && 'current' in externalRef) {
        ;(externalRef as React.RefObject<HTMLImageElement | null>).current = node
      }
      if (node?.complete) {
        setLoaded(true)
      }
    },
    [externalRef],
  )

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
    const url = `${API_ACTIONS.image.resolveThumbhash.path}?src=${encodeURIComponent(src)}`
    void fetch(url)
      .then((response) => response.json())
      .then((json: unknown) => {
        if (cancelled) {
          return
        }
        const data = (json as { data?: { thumbhash?: string | null; width?: number | null; height?: number | null } })
          ?.data
        const next: ResolvedImageMeta = {}
        if (typeof data?.thumbhash === 'string' && data.thumbhash !== '') {
          next.thumbhash = data.thumbhash
          setThumbhash(data.thumbhash)
        }
        if (typeof data?.width === 'number' && data.width > 0) {
          next.width = data.width
          setWidth(data.width)
        }
        if (typeof data?.height === 'number' && data.height > 0) {
          next.height = data.height
          setHeight(data.height)
        }
        if (next.thumbhash !== undefined || next.width !== undefined || next.height !== undefined) {
          imageMetaBySrcCache.set(src, next)
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

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true)
      onLoad?.(e)
    },
    [onLoad],
  )

  return (
    <img
      {...rest}
      ref={setRef}
      width={rest.width ?? width}
      height={rest.height ?? height}
      alt={alt}
      loading={loading}
      decoding={decoding}
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
