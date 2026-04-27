import type { ImgHTMLAttributes } from 'react'

import { useThumbhashBackground } from '@/client/hooks/use-thumbhash-bg'
import { getImageUrl } from '@/shared/image-url'

export interface ImageProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'width' | 'height' | 'loading' | 'fetchPriority'
> {
  src: string
  alt: string
  width: number
  height: number
  thumbhash?: string
  /** Pass-through for the image service; defaults to 100. */
  quality?: number
  /**
   * Mark the image as an LCP candidate. When `true`, we set
   * `loading="eager"` and `fetchPriority="high"` so the browser starts
   * the network request before idle and prioritises the bytes against
   * other concurrent fetches. Reserved for the first hero / feature
   * card on a route — see Vercel's `rendering-resource-hints` rule and
   * P1-6 in the refactor plan. Defaults to `false` (lazy + auto).
   */
  priority?: boolean
}

export function Image({ src, alt, width, height, thumbhash, quality, priority = false, style, ...rest }: ImageProps) {
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
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      style={mergedStyle}
    />
  )
}
