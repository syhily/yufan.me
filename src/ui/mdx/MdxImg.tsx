import type { ImgHTMLAttributes } from 'react'

import { useThumbhashBackground } from '@/client/hooks/use-thumbhash-bg'

// `<img>` override for compiled MDX bodies. The compile-time
// `rehype-image-enhance.server.ts` plugin already inlines `width`, `height`,
// the upyun-rewritten `src`, and `data-thumbhash`, so this component only
// needs to wire the thumbhash placeholder into the React tree at hydration
// time. No runtime ultrahtml parse, no per-image metadata fetch.
export type MdxImgProps = ImgHTMLAttributes<HTMLImageElement> & {
  'data-thumbhash'?: string
}

export function MdxImg({ alt = '', loading = 'lazy', decoding = 'async', style, ...rest }: MdxImgProps) {
  const thumbhash = rest['data-thumbhash']
  const thumbhashStyle = useThumbhashBackground(thumbhash)
  const mergedStyle =
    thumbhashStyle === undefined ? style : style === undefined ? thumbhashStyle : { ...thumbhashStyle, ...style }

  return <img {...rest} alt={alt} loading={loading} decoding={decoding} style={mergedStyle} />
}
