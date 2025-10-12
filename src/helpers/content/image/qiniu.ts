import type { ExternalImageService, ImageTransform } from 'astro'
import { baseService } from 'astro/assets'
import { inferRemoteSize, isESMImportedImage } from 'astro/assets/utils'
import { getImageMetadata } from '../schema'
import { isRemoteAllowed } from './assets'
import { blurHashToDataURL } from './blurhash'

async function getImage(source: string, options: ImageTransform): Promise<{ width: number, height: number, blurhash?: string }> {
  const { width, height } = options
  const metadata = getImageMetadata(source)
  if (metadata) {
    return { width: width || metadata.width, height: height || metadata.height, blurhash: metadata.blurhash }
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
    if (!options.width || !options.height || !options.style) {
      const imageSource = isESMImportedImage(options.src) ? options.src.src : options.src
      if (!isRemoteAllowed(imageSource, imageConfig)) {
        throw new Error(`Image source ${imageSource} is not allowed`)
      }
      const { width, height, blurhash } = await getImage(imageSource, options)
      options.width = options.width || width
      options.height = options.height || height
      if (blurhash) {
        options.style = {
          ...options.style,
          'background-image': `url("${blurHashToDataURL(blurhash)}")`,
          'background-position': 'center',
          'background-size': 'cover',
          'background-repeat': 'no-repeat',
        }
      }
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
    return `${imageSource}?imageView2/1/w/${options.width}/h/${options.height}/format/avif/q/${typeof options.quality === 'number' ? options.quality : 100}/ignore-error/1`
  },
  getHTMLAttributes(options, _imageConfig) {
    const { src, format, quality, ...attributes } = options
    return {
      ...attributes,
      loading: 'lazy',
      decoding: 'async',
    }
  },
}

export default service
