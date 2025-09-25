import type { ExternalImageService, ImageTransform } from 'astro'
import { baseService } from 'astro/assets'
import { inferRemoteSize, isESMImportedImage } from 'astro/assets/utils'
import { getImageMetadata } from '../schema.js'
import { isRemoteAllowed } from './assets.js'

async function getImage(source: string, options: ImageTransform): Promise<{ width: number, height: number, background?: string }> {
  const { width, height } = options
  const metadata = getImageMetadata(source)
  if (metadata) {
    return { width: width || metadata.width, height: height || metadata.height, background: metadata.blurDataURL }
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
      const { width, height, background } = await getImage(imageSource, options)
      options.width = options.width || width
      options.height = options.height || height
      if (background) {
        const std = 20
        const svgWidth = 8 * 40
        const svgHeight = options.height / options.width * svgWidth
        const viewBox
          = svgWidth && svgHeight ? `viewBox='0 0 ${svgWidth} ${svgHeight}'` : ''
        const svg = `%3Csvg xmlns='http://www.w3.org/2000/svg' ${viewBox}%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='${std}'/%3E%3C/filter%3E%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='none' style='filter: url(%23b);' href='${background}'/%3E%3C/svg%3E`

        options.style = {
          'background-image': `url("data:image/svg+xml;charset=utf-8,${svg}")`,
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
