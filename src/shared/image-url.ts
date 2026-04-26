import config from '@/blog.config'

const assetHost = config.settings.asset.host

export interface ImageUrlOptions {
  src: string
  width: number
  height: number
  quality?: number
}

export function getImageUrl({ src, width, height, quality }: ImageUrlOptions): string {
  if (!isTransformableRemoteImage(src)) {
    return src
  }

  const imageQuality = typeof quality === 'number' ? quality : 100
  return `${src}!upyun520/both/${width}x${height}/format/webp/quality/${imageQuality}/unsharp/true/progressive/true`
}

export function isTransformableRemoteImage(src: string): boolean {
  if (src.startsWith('data:')) {
    return false
  }

  try {
    const url = new URL(src)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname === assetHost &&
      !url.pathname.includes('!upyun520/')
    )
  } catch {
    return false
  }
}
