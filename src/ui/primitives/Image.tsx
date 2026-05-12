import type { ImgHTMLAttributes, Ref } from 'react'

import { useThumbhashBackground } from '@/client/hooks/use-thumbhash-bg'
import { getImageSrcset, getImageUrl } from '@/shared/images'
import { useAssetsSettings } from '@/ui/lib/blog-config-context'
import { useImageLoaded } from '@/ui/primitives/use-image-loaded'

export interface RawImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height' | 'ref'> {
  src: string
  alt: string
  width: number
  height: number
  thumbhash?: string
  /** Pass-through for the image service; defaults to 100. */
  quality?: number
  /** Responsive `sizes` attribute. When provided, a `srcset` is generated automatically. */
  sizes?: string
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
  sizes,
  assetHost,
  urlTemplate,
  loading = 'lazy',
  decoding = 'async',
  style,
  onLoad,
  ref: externalRef,
  ...rest
}: RawImageProps) {
  const { ref, loaded, handleLoad } = useImageLoaded(externalRef, onLoad)
  const thumbhashStyle = useThumbhashBackground(thumbhash, loaded)
  const srcset =
    sizes !== undefined && sizes !== ''
      ? getImageSrcset({ src, width, height, quality, assetHost: assetHost ?? '', urlTemplate })
      : undefined
  const mergedStyle: React.CSSProperties =
    thumbhashStyle === undefined
      ? { ...style }
      : style === undefined
        ? { ...thumbhashStyle }
        : { ...thumbhashStyle, ...style }

  return (
    <img
      {...rest}
      ref={ref}
      src={getImageUrl({ src, width, height, quality, assetHost: assetHost ?? '', urlTemplate })}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      sizes={sizes}
      srcSet={srcset}
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
