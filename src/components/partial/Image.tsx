import type { ImgHTMLAttributes } from 'react'

import config from '@/blog.config'

export interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> {
  src: string
  alt: string
  width: number
  height: number
  /** Pass-through for the image service; defaults to 100. */
  quality?: number
}

const assetHost = config.settings.asset.host

export function Image({ src, alt, width, height, quality, loading = 'lazy', decoding = 'async', ...rest }: ImageProps) {
  return (
    <img
      {...rest}
      src={getImageUrl({ src, width, height, quality })}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
    />
  )
}

interface ImageUrlOptions {
  src: string
  width: number
  height: number
  quality?: number
}

function getImageUrl({ src, width, height, quality }: ImageUrlOptions) {
  if (!isTransformableRemoteImage(src)) {
    return src
  }

  const imageQuality = typeof quality === 'number' ? quality : 100
  return `${src}!upyun520/both/${width}x${height}/format/webp/quality/${imageQuality}/unsharp/true/progressive/true`
}

function isTransformableRemoteImage(src: string) {
  if (src.startsWith('data:')) {
    return false
  }

  try {
    const url = new URL(src)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname === assetHost
  } catch {
    return false
  }
}
