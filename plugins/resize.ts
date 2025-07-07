import type { ImageOutputFormat, ImageQualityPreset, LocalImageService } from 'astro'
import { baseService } from 'astro/assets'

const qualityTable: Record<ImageQualityPreset, number> = {
  low: 25,
  mid: 50,
  high: 80,
  max: 100,
}

function parseQuality(quality: string): string | number {
  const result = Number.parseInt(quality)
  if (Number.isNaN(result)) {
    return quality
  }

  return result
}

interface BaseServiceTransform {
  src: string
  width?: number
  height?: number
  format: string
  quality?: string | null
}

interface SharpImageServiceConfig {
  /**
   * The `limitInputPixels` option passed to Sharp. See https://sharp.pixelplumbing.com/api-constructor for more information
   */
  limitInputPixels?: import('sharp').SharpOptions['limitInputPixels']
}

const imageService: LocalImageService<SharpImageServiceConfig> = {
  getURL: baseService.getURL,
  getSrcSet: baseService.getSrcSet,
  getHTMLAttributes: baseService.getHTMLAttributes,
  validateOptions: baseService.validateOptions,
  parseURL: baseService.parseURL,
  async transform(inputBuffer, transformOptions, config) {
    const { default: sharp } = await import('sharp')
    const transform: BaseServiceTransform = transformOptions as BaseServiceTransform

    // Sharp has some support for SVGs, we could probably support this once Sharp is the default and only service.
    if (transform.format === 'svg')
      return { data: inputBuffer, format: 'svg' }

    const result = sharp(inputBuffer, {
      failOnError: false,
      pages: -1,
      limitInputPixels: config.service.config.limitInputPixels,
    })

    result.rotate()

    // Never resize using both width and height at the same time, prioritizing width.
    if (transform.height) {
      if (!transform.width) {
        result.resize({ height: Math.round(transform.height) })
      }
      else {
        // Allow the width and height to be set.
        result.resize({ width: Math.round(transform.width), height: Math.round(transform.height) })
      }
    }
    else if (transform.width) {
      result.resize({ width: Math.round(transform.width) })
    }

    if (transform.format) {
      let quality: number | string | undefined
      if (transform.quality) {
        const parsedQuality = parseQuality(transform.quality)
        if (typeof parsedQuality === 'number') {
          quality = parsedQuality
        }
        else {
          quality = transform.quality in qualityTable ? qualityTable[transform.quality] : undefined
        }
      }

      result.toFormat(transform.format as keyof import('sharp').FormatEnum, { quality })
    }

    const { data, info } = await result.toBuffer({ resolveWithObject: true })

    return {
      data,
      format: info.format as ImageOutputFormat,
    }
  },
}

export default imageService
