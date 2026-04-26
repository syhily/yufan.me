import type { ImgHTMLAttributes } from 'react'

import { useThumbhashBackground } from '@/client/hooks/use-thumbhash-bg'
import { getImageUrl } from '@/shared/image-url'

export interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> {
  src: string
  alt: string
  width: number
  height: number
  thumbhash?: string
  /** Pass-through for the image service; defaults to 100. */
  quality?: number
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
  ...rest
}: ImageProps) {
  const thumbhashStyle = useThumbhashBackground(thumbhash)
  const mergedStyle =
    thumbhashStyle === undefined ? style : style === undefined ? thumbhashStyle : { ...thumbhashStyle, ...style }

  return (
    <img
      {...rest}
      src={getImageUrl({ src, width, height, quality })}
      data-thumbhash={thumbhash}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      style={mergedStyle}
    />
  )
}
