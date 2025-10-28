import type { ImageOutputFormat, ImageQualityPreset, LocalImageService } from 'astro'
import type { SharpImageServiceConfig } from 'astro/assets/services/sharp'
import type { FormatEnum } from 'sharp'
import { baseService } from 'astro/assets'
import { isESMImportedImage } from 'astro/assets/utils'
import { inferRemoteSize } from 'astro:assets'
import sharp from 'sharp'
import { isRemoteAllowed } from './assets.js'

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

const imageService: LocalImageService<SharpImageServiceConfig> = {
  ...baseService,
  async validateOptions(options, imageConfig) {
    if (!options.width || !options.height) {
      const imageSource = isESMImportedImage(options.src) ? options.src.src : options.src
      if (isRemoteAllowed(imageSource, imageConfig)) {
        // Load the remote image size manually.
        // This is only used for local development with remote images.
        // In production, the image should be uploaded to the S3 services with image metadata.
        const { width, height } = await inferRemoteSize(imageSource)
        options.width = options.width || width
        options.height = options.height || height
      }
    }

    // Add widths on demand.
    if (!options.widths || options.widths.length === 0) {
      options.widths = [
        500,
        600,
        640,
        750,
        828,
        960,
        1080,
        1200,
        1400,
        1600,
      ]
    }

    if (typeof baseService.validateOptions === 'function') {
      return await baseService.validateOptions(options, imageConfig)
    }
    throw new Error('baseService.validateOptions is not defined')
  },
  async transform(inputBuffer, transformOptions, config) {
    const transform = transformOptions

    // Sharp has some support for SVGs, we could probably support this once Sharp is the default and only service.
    if (transform.format === 'svg') {
      return { data: inputBuffer, format: 'svg' }
    }

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
      let quality: number = qualityTable.mid
      if (transform.quality) {
        const parsedQuality = parseQuality(transform.quality)
        if (typeof parsedQuality === 'number') {
          quality = parsedQuality
        }
        else {
          quality = transform.quality in qualityTable ? qualityTable[transform.quality] : Number(transform.quality)
        }
      }
      result.toFormat(transform.format as keyof FormatEnum, { quality })
    }

    const { data, info } = await result.toBuffer({ resolveWithObject: true })
    return {
      data,
      format: info.format as ImageOutputFormat,
    }
  },
}

export default imageService
