export interface ImageUrlOptions {
  src: string
  width: number
  height: number
  quality?: number
  /**
   * The asset CDN host the image is expected to live on. The caller
   * threads this in from `useRequiredBlogConfig()` (UI / SSR) or
   * `requireBlogConfig()` (server-only) so this helper stays a pure,
   * isomorphic function with no hidden global lookup.
   */
  assetHost: string
}

export function getImageUrl({ src, width, height, quality, assetHost }: ImageUrlOptions): string {
  if (!isTransformableRemoteImage(src, assetHost)) {
    return src
  }

  const imageQuality = typeof quality === 'number' ? quality : 100
  return `${src}!upyun520/both/${width}x${height}/format/webp/quality/${imageQuality}/unsharp/true/progressive/true`
}

export function isTransformableRemoteImage(src: string, assetHost: string): boolean {
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
