import type { AstroConfig, ExternalImageService, ImageTransform } from 'astro'

const service: ExternalImageService = {
  validateOptions(options: ImageTransform, imageConfig: AstroConfig['image']) {
    const serviceConfig = imageConfig.service.config

    // Enforce the user set max width.
    if (options.width && options.width > serviceConfig.maxWidth) {
      console.warn(`Image width ${options.width} exceeds max width ${serviceConfig.maxWidth}. Falling back to max width.`)
      options.width = serviceConfig.maxWidth
    }

    return options
  },
  getURL(options, _imageConfig) {
    return `${options.src}!upyun520/both/${options.width}x${options.height}/format/webp/quality/${typeof options.quality === 'number' ? options.quality : 100}/unsharp/true/progressive/true`
  },
  getHTMLAttributes(options, _imageConfig) {
    const { src, format, quality, ...attributes } = options
    return {
      ...attributes,
      loading: options.loading ?? 'lazy',
      decoding: options.decoding ?? 'async',
    }
  },
}

export default service
