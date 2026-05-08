import { useCallback, useLayoutEffect, useRef, useState, type ImgHTMLAttributes, type Ref } from 'react'

import { useThumbhashBackground } from '@/client/hooks/use-thumbhash-bg'
import { getImageUrl } from '@/shared/images'
import { useAssetsSettings } from '@/ui/lib/blog-config-context'

export interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height' | 'ref'> {
  src: string
  alt: string
  width: number
  height: number
  thumbhash?: string
  /** Pass-through for the image service; defaults to 100. */
  quality?: number
  ref?: Ref<HTMLImageElement>
}

export function Image({
  src,
  alt,
  width,
  height,
  thumbhash,
  quality,
  loading = 'lazy',
  decoding = 'async',
  style,
  onLoad,
  ref: externalRef,
  ...rest
}: ImageProps) {
  const [loaded, setLoaded] = useState(false)
  const { asset, storage } = useAssetsSettings()
  const thumbhashStyle = useThumbhashBackground(thumbhash, loaded)
  const mergedStyle: React.CSSProperties =
    thumbhashStyle === undefined
      ? { ...style }
      : style === undefined
        ? { ...thumbhashStyle }
        : { ...thumbhashStyle, ...style }

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
      src={getImageUrl({ src, width, height, quality, assetHost: asset.host, urlTemplate: storage.urlTemplate })}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      style={mergedStyle}
      onLoad={handleLoad}
    />
  )
}
