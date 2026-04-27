import type { ImgHTMLAttributes } from 'react'

import { useThumbhashBackground } from '@/client/hooks/use-thumbhash-bg'
import { cn } from '@/ui/lib/cn'

// `<img>` override for compiled MDX bodies. The compile-time
// `rehype-image-enhance.server.ts` plugin already inlines `width`, `height`,
// the upyun-rewritten `src`, and `data-thumbhash`, so this component only
// needs to wire the thumbhash placeholder into the React tree at hydration
// time. No runtime ultrahtml parse, no per-image metadata fetch.
//
// The legacy `img { display: flex; justify-content: center }` rule from
// the Bootstrap-era prose host moves here as the default className.
// Authors can still override it per-image by passing `className` on the
// MDX `<img>` (rehype passes any extra attributes through).
export type MdxImgProps = ImgHTMLAttributes<HTMLImageElement> & {
  'data-thumbhash'?: string
}

const MDX_IMG_BASE = 'flex justify-center'

export function MdxImg({ alt = '', loading = 'lazy', decoding = 'async', className, style, ...rest }: MdxImgProps) {
  const thumbhash = rest['data-thumbhash']
  const thumbhashStyle = useThumbhashBackground(thumbhash)
  const mergedStyle =
    thumbhashStyle === undefined ? style : style === undefined ? thumbhashStyle : { ...thumbhashStyle, ...style }

  return (
    <img
      {...rest}
      alt={alt}
      loading={loading}
      decoding={decoding}
      className={cn(MDX_IMG_BASE, className)}
      style={mergedStyle}
    />
  )
}
