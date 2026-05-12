import { useCallback, useLayoutEffect, useRef, useState, type ImgHTMLAttributes, type Ref } from 'react'

import { useThumbhashBackground } from '@/client/hooks/use-thumbhash-bg'
import { getImageUrl } from '@/shared/images'
import { useAssetsSettings } from '@/ui/lib/blog-config-context'

export interface RawImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height' | 'ref'> {
  src: string
  alt: string
  width: number
  height: number
  thumbhash?: string
  /** Pass-through for the image service; defaults to 100. */
  quality?: number
  ref?: Ref<HTMLImageElement>
  /** Asset host used for CDN image transforms. */
  assetHost?: string
  /** Transform template for the CDN; used together with `assetHost`. */
  urlTemplate?: string
}

export function RawImage({
  src,
  alt,
  width,
  height,
  thumbhash,
  quality,
  assetHost,
  urlTemplate,
  loading = 'lazy',
  decoding = 'async',
  style,
  onLoad,
  ref: externalRef,
  ...rest
}: RawImageProps) {
  const [loaded, setLoaded] = useState(false)
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
      src={getImageUrl({ src, width, height, quality, assetHost: assetHost ?? '', urlTemplate })}
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

// TODO: migrate callers to pass `assetHost` / `urlTemplate` explicitly
// and consume `RawImage` directly, so this wrapper can be removed.
export function Image(props: Omit<RawImageProps, 'assetHost' | 'urlTemplate'>) {
  const { asset, storage } = useAssetsSettings()
  return <RawImage {...props} assetHost={asset.host} urlTemplate={storage.urlTemplate} />
}
