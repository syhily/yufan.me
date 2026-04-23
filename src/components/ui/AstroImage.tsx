// Thin TSX wrapper around Astro's `astro:assets` `getImage()` helper.
//
// `<Image />` from `astro:assets` is an Astro component and therefore cannot be
// rendered from inside a `.tsx` React tree. `getImage()` exposes the same
// pipeline programmatically and returns the optimized URL plus the attribute
// set the Astro component would have emitted. We splat the result into a
// plain `<img>` so the optimized `src`, blurhash background style, width, and
// height all reach the DOM unchanged. The custom image service at
// `src/services/images/service.ts` (UPYUN webp pipeline + thumbhash) keeps
// being invoked exactly as before because it's registered globally in
// `astro.config.ts`.
import type { CSSProperties, ImgHTMLAttributes } from 'react'

import { getImage } from 'astro:assets'

export interface AstroImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> {
  src: string
  alt: string
  width: number
  height: number
  /** Pass-through for the image service; defaults to 100 (lossless). */
  quality?: number
  /** Defaults to `lazy` to match the browser `<img>` default. */
  loading?: 'lazy' | 'eager'
  /** Defaults to `async`. */
  decoding?: 'async' | 'sync' | 'auto'
}

export async function AstroImage({
  src,
  alt,
  width,
  height,
  quality,
  loading = 'lazy',
  decoding = 'async',
  className,
  style,
  ...rest
}: AstroImageProps) {
  const optimized = await getImage({
    src,
    width,
    height,
    ...(quality !== undefined ? { quality } : {}),
  })

  const serviceAttrs = optimized.attributes ?? {}
  const mergedStyle = mergeStyle(serviceAttrs.style, style)
  const finalWidth = (serviceAttrs.width as number | string | undefined) ?? width
  const finalHeight = (serviceAttrs.height as number | string | undefined) ?? height
  const srcSet = optimized.srcSet?.attribute ? optimized.srcSet.attribute : undefined

  return (
    <img
      {...rest}
      src={optimized.src}
      srcSet={srcSet}
      alt={alt}
      width={finalWidth}
      height={finalHeight}
      loading={loading}
      decoding={decoding}
      className={className}
      style={mergedStyle}
    />
  )
}

function mergeStyle(cssText: unknown, reactStyle: CSSProperties | undefined): CSSProperties | undefined {
  if (typeof cssText !== 'string' && !reactStyle) return undefined
  const parsed: Record<string, string> = {}
  if (typeof cssText === 'string' && cssText !== '') {
    for (const decl of cssText.split(';')) {
      const idx = decl.indexOf(':')
      if (idx === -1) continue
      const key = decl.slice(0, idx).trim()
      const value = decl.slice(idx + 1).trim()
      if (!key) continue
      const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
      parsed[camel] = value
    }
  }
  return { ...parsed, ...(reactStyle ?? {}) }
}
