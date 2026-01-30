import type { AstroConfig, ExternalImageService, ImageTransform, RemotePattern } from 'astro'
import { Buffer } from 'node:buffer'
import { isRemotePath } from '@astrojs/internal-helpers/path'
import { baseService } from 'astro/assets'
import { inferRemoteSize, isESMImportedImage } from 'astro/assets/utils'
import { thumbHashToDataURL } from 'thumbhash'

function matchHostname(url: URL, hostname?: string, allowWildcard?: boolean) {
  if (!hostname) {
    return true
  }
  if (!allowWildcard || !hostname.startsWith('*')) {
    return hostname === url.hostname
  }
  if (hostname.startsWith('**.')) {
    const slicedHostname = hostname.slice(2) // ** length
    return slicedHostname !== url.hostname && url.hostname.endsWith(slicedHostname)
  }
  if (hostname.startsWith('*.')) {
    const slicedHostname = hostname.slice(1) // * length
    const additionalSubdomains = url.hostname
      .replace(slicedHostname, '')
      .split('.')
      .filter(Boolean)
    return additionalSubdomains.length === 1
  }
  return false
}

function matchPort(url: URL, port?: string) {
  return !port || port === url.port
}

function matchProtocol(url: URL, protocol?: string) {
  return !protocol || protocol === url.protocol.slice(0, -1)
}

function matchPathname(url: URL, pathname?: string, allowWildcard?: boolean) {
  if (!pathname) {
    return true
  }
  if (!allowWildcard || !pathname.endsWith('*')) {
    return pathname === url.pathname
  }
  if (pathname.endsWith('/**')) {
    const slicedPathname = pathname.slice(0, -2) // ** length
    return slicedPathname !== url.pathname && url.pathname.startsWith(slicedPathname)
  }
  if (pathname.endsWith('/*')) {
    const slicedPathname = pathname.slice(0, -1) // * length
    const additionalPathChunks = url.pathname
      .replace(slicedPathname, '')
      .split('/')
      .filter(Boolean)
    return additionalPathChunks.length === 1
  }
  return false
}

function matchPattern(url: URL, remotePattern: RemotePattern) {
  return (
    matchProtocol(url, remotePattern.protocol)
    && matchHostname(url, remotePattern.hostname, true)
    && matchPort(url, remotePattern.port)
    && matchPathname(url, remotePattern.pathname, true)
  )
}

function isRemoteAllowed(
  src: string,
  {
    domains = [],
    remotePatterns = [],
  }: Partial<Pick<AstroConfig['image'], 'domains' | 'remotePatterns'>>,
): boolean {
  if (src.startsWith('data:')) {
    return false
  }
  if (!isRemotePath(src)) {
    return false
  }

  const url = new URL(src)
  return (
    domains.some(domain => matchHostname(url, domain))
    || remotePatterns.some(remotePattern => matchPattern(url, remotePattern))
  )
}

interface ImageMetadata {
  width: number
  height: number
  blurhash: string
}

const globalForImage = globalThis as unknown as {
  imageMetadataCache: Record<string, ImageMetadata> | undefined
}
if (globalForImage.imageMetadataCache === undefined) {
  globalForImage.imageMetadataCache = {}
}
const imageMetadataCache = globalForImage.imageMetadataCache

async function getImageMetadata(source: string): Promise<ImageMetadata | null> {
  if (imageMetadataCache[source]) {
    return imageMetadataCache[source]
  }

  try {
    const response = await fetch(`${source.slice(0, source.lastIndexOf('.'))}.json`)
    if (!response.ok) {
      return null
    }
    const metadata = await response.json() as ImageMetadata
    if (metadata.blurhash !== '') {
      imageMetadataCache[source] = metadata
    }
    return metadata
  }
  catch {
    return null
  }
}

async function getImage(source: string, options: ImageTransform): Promise<{ width: number, height: number, blurhash?: string }> {
  const { width, height } = options
  const metadata = await getImageMetadata(source)
  if (metadata) {
    return { width: width || metadata.width, height: height || metadata.height, blurhash: thumbHashToDataURL(Buffer.from(metadata.blurhash, 'base64')) }
  }
  if (!width || !height) {
    const { width, height } = await inferRemoteSize(source)
    return { width, height }
  }
  return { width, height }
}

const service: ExternalImageService = {
  ...baseService,
  async validateOptions(options, imageConfig) {
    if (!options.width || !options.height || !options.style || !options.style['background-image']) {
      const imageSource = isESMImportedImage(options.src) ? options.src.src : options.src
      if (!imageSource.startsWith('data:')) {
        if (!isRemoteAllowed(imageSource, imageConfig)) {
          throw new Error(`Image source ${imageSource} is not allowed`)
        }
        const { width, height, blurhash } = await getImage(imageSource, options)
        options.width = options.width || width
        options.height = options.height || height
        if (blurhash) {
          options.style = {
            'background-image': `url("${blurhash}")`,
            'background-position': 'center',
            'background-size': 'cover',
            'background-repeat': 'no-repeat',
          }
        }
      }
    }

    // Add sizes for images in article.
    if (!options.fit) {
      options.fit = 'fill'
    }

    if (typeof baseService.validateOptions === 'function') {
      return await baseService.validateOptions(options, imageConfig)
    }
    throw new Error('baseService.validateOptions is not defined')
  },
  async getURL(options, imageConfig) {
    const imageSource = isESMImportedImage(options.src) ? options.src.src : options.src
    if (!isRemoteAllowed(imageSource, imageConfig)) {
      return imageSource
    }
    return `${imageSource}!upyun520/both/${options.width}x${options.height}/format/webp/quality/${typeof options.quality === 'number' ? options.quality : 100}/unsharp/true/progressive/true`
  },
}

export default service
